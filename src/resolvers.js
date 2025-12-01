import axios from "axios";
import DataLoader from "dataloader";
import { STUDENT_URL, COURSE_URL } from "./config.js";

// ✅ Clients Axios avec meilleure configuration pour le cloud
const studentClient = axios.create({ 
  baseURL: STUDENT_URL, 
  timeout: 15000, // Augmenté pour le réseau cloud
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

const courseClient = axios.create({ 
  baseURL: COURSE_URL, 
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// ✅ Intercepteurs pour le logging en production
if (process.env.NODE_ENV === 'production') {
  studentClient.interceptors.response.use(
    response => response,
    error => {
      console.error('Student Service Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        message: error.message
      });
      return Promise.reject(error);
    }
  );
  
  courseClient.interceptors.response.use(
    response => response,
    error => {
      console.error('Course Service Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        message: error.message
      });
      return Promise.reject(error);
    }
  );
}

// ✅ DataLoader optimisé
export function createCoursesLoader() {
  return new DataLoader(async (studentIds) => {
    console.log(`📚 DataLoader - Chargement cours pour ${studentIds.length} étudiants`);
    
    try {
      const promises = studentIds.map(id =>
        courseClient
          .get(`/student/${id}/courses/`)
          .then(r => {
            if (r.data && Array.isArray(r.data)) {
              return r.data.map(course => ({
                id: course.id,
                name: course.name,
                instructor: course.instructor,
                category: course.category,
                schedule: course.schedule
              }));
            }
            return [];
          })
          .catch(error => {
            console.warn(`⚠️ Aucun cours trouvé pour l'étudiant ${id}:`, error.message);
            return [];
          })
      );
      return await Promise.all(promises);
    } catch (error) {
      console.error('❌ DataLoader error:', error.message);
      return studentIds.map(() => []);
    }
  }, { 
    cache: true,
    batchScheduleFn: callback => setTimeout(callback, 10) // Micro-batching
  });
}

// ✅ Resolvers avec meilleure gestion d'erreurs
export const resolvers = {
  Query: {
    // ✅ Health check pour Render
    health: () => ({
      status: "OK",
      timestamp: new Date().toISOString(),
      services: {
        student: STUDENT_URL,
        course: COURSE_URL
      }
    }),

    students: async () => {
      try {
        const res = await studentClient.get("/api/students");
        return res.data.map(s => ({
          id: s.id,
          first_name: s.firstName || s.first_name,
          last_name: s.lastName || s.last_name,
          email: s.email,
        }));
      } catch (error) {
        console.error("❌ Error fetching students:", error.message);
        throw new Error(`Failed to fetch students: ${error.response?.data?.detail || error.message}`);
      }
    },

    student: async (_, { id }) => {
      try {
        const res = await studentClient.get(`/api/students/${id}`);
        const s = res.data;
        return {
          id: s.id,
          first_name: s.firstName || s.first_name,
          last_name: s.lastName || s.last_name,
          email: s.email,
        };
      } catch (error) {
        console.error(`❌ Error fetching student ${id}:`, error.message);
        throw new Error(`Student not found: ${id}`);
      }
    },

    courses: async () => {
      try {
        const res = await courseClient.get("/api/courses");
        return res.data.map(c => ({
          id: c.id,
          name: c.name,
          instructor: c.instructor,
          category: c.category,
          schedule: c.schedule,
        }));
      } catch (error) {
        console.error("❌ Error fetching courses:", error.message);
        throw new Error(`Failed to fetch courses: ${error.response?.data?.detail || error.message}`);
      }
    },

    course: async (_, { id }) => {
      try {
        const res = await courseClient.get(`/api/courses/${id}`);
        const c = res.data;
        return {
          id: c.id,
          name: c.name,
          instructor: c.instructor,
          category: c.category,
          schedule: c.schedule,
        };
      } catch (error) {
        console.error(`❌ Error fetching course ${id}:`, error.message);
        throw new Error(`Course not found: ${id}`);
      }
    },

    courseStudents: async (_, { courseId }) => {
      try {
        console.log(`🎯 GraphQL - Récupération étudiants du cours: ${courseId}`);
        
        const response = await courseClient.get(`/course/${courseId}/students/`);
        
        if (!response.data || !response.data.students) {
          return [];
        }

        return response.data.students.map(student => ({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          university: student.university || null
        }));

      } catch (error) {
        console.error("❌ Erreur courseStudents:", error.message);
        return [];
      }
    },
  },

  Mutation: {
    enrollStudent: async (_, { courseId, studentId }) => {
      try {
        console.log(`🎯 GraphQL - Inscription: étudiant ${studentId} au cours ${courseId}`);
        
        // ✅ Validation des IDs
        const studentIdNum = parseInt(studentId);
        const courseIdNum = parseInt(courseId);
        
        if (isNaN(studentIdNum) || isNaN(courseIdNum)) {
          return {
            success: false,
            message: "❌ IDs doivent être des nombres valides",
            enrollment: null
          };
        }

        const payload = {
          student_id: studentIdNum,
          course_id: courseIdNum
        };

        console.log("📦 Payload envoyé à Django:", payload);

        const response = await courseClient.post("/enroll/", payload);

        console.log("✅ Réponse Django:", response.data);

        return {
          success: true,
          message: response.data.message || "✅ Étudiant inscrit avec succès",
          enrollment: {
            id: Date.now(),
            student: { id: studentId },
            course: { id: courseId }
          }
        };

      } catch (error) {
        console.error("❌ Erreur détaillée enrollment:", {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });

        let errorMessage = "Erreur lors de l'inscription";
        
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          
          if (status === 400) {
            errorMessage = data.error || "Données invalides";
          } else if (status === 404) {
            errorMessage = "Étudiant ou cours non trouvé";
          } else if (status === 409) {
            errorMessage = "L'étudiant est déjà inscrit à ce cours";
          } else if (data && data.error) {
            errorMessage = `❌ ${data.error}`;
          } else {
            errorMessage = `Erreur serveur: ${status}`;
          }
        } else if (error.code === 'ECONNREFUSED') {
          errorMessage = "❌ Service cours indisponible";
        } else if (error.code === 'ETIMEDOUT') {
          errorMessage = "❌ Timeout - Service cours trop lent";
        }

        return {
          success: false,
          message: errorMessage,
          enrollment: null
        };
      }
    },

    // ✅ Ajouter d'autres mutations si besoin
    unenrollStudent: async (_, { courseId, studentId }) => {
      try {
        const response = await courseClient.delete(`/unenroll/`, {
          data: { student_id: parseInt(studentId), course_id: parseInt(courseId) }
        });
        
        return {
          success: true,
          message: response.data.message || "✅ Désinscription réussie"
        };
      } catch (error) {
        console.error("❌ Erreur unenroll:", error.message);
        return {
          success: false,
          message: error.response?.data?.error || "Erreur lors de la désinscription"
        };
      }
    }
  },

  Student: {
    courses: async (parent, _, { loaders }) => {
      try {
        // ✅ Utilisation du DataLoader
        return await loaders.coursesLoader.load(parent.id);
      } catch (error) {
        console.error(`Erreur récupération cours étudiant ${parent.id}:`, error.message);
        return [];
      }
    },
  },

  Course: {
    students: async (parent) => {
      try {
        const courseId = parent.id;
        const response = await courseClient.get(`/course/${courseId}/students/`);
        
        if (!response.data || !response.data.students) {
          return [];
        }

        return response.data.students.map(student => ({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          university: student.university || null
        }));

      } catch (error) {
        console.error(`Erreur récupération étudiants cours ${parent.id}:`, error.message);
        return [];
      }
    }
  }
};