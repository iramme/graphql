import axios from "axios";
import DataLoader from "dataloader";
import { STUDENT_URL, COURSE_URL } from "./config.js";

// ✅ Clients Axios
const studentClient = axios.create({ 
  baseURL: STUDENT_URL, 
  timeout: 10000 
});

const courseClient = axios.create({ 
  baseURL: COURSE_URL, 
  timeout: 10000 
});

// ✅ DataLoader
export function createCoursesLoader() {
  return new DataLoader(async (studentIds) => {
    const promises = studentIds.map(id =>
      courseClient
        .get(`/student/${id}/courses/`)  // ✅ URL corrigée
        .then(r => r.data)
        .catch(() => [])
    );
    return await Promise.all(promises);
  }, { cache: true });
}

// ✅ Resolvers CORRIGÉS
export const resolvers = {
  Query: {
    students: async () => {
      const res = await studentClient.get("/api/students");
      return res.data.map(s => ({
        id: s.id,
        first_name: s.firstName,
        last_name: s.lastName,
        email: s.email,
      }));
    },

    student: async (_, { id }) => {
      const res = await studentClient.get(`/api/students/${id}`);
      const s = res.data;
      return {
        id: s.id,
        first_name: s.firstName,
        last_name: s.lastName,
        email: s.email,
      };
    },

    courses: async () => {
      const res = await courseClient.get("/api/courses");
      return res.data.map(c => ({
        id: c.id,
        name: c.name,
        instructor: c.instructor,
        category: c.category,
        schedule: c.schedule,
      }));
    },

    course: async (_, { id }) => {
      const res = await courseClient.get(`/api/courses/${id}`);
      const c = res.data;
      return {
        id: c.id,
        name: c.name,
        instructor: c.instructor,
        category: c.category,
        schedule: c.schedule,
      };
    },

    // ✅ Query pour récupérer les étudiants d'un cours
    courseStudents: async (_, { courseId }) => {
      try {
        console.log(`🎯 GraphQL - Récupération étudiants du cours: ${courseId}`);
        
        const response = await courseClient.get(`/course/${courseId}/students/`);
        
        if (!response.data || !response.data.students) {
          return [];
        }

        // ✅ Retourner directement les données formatées par Django
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
    // 🔥 MUTATION : Inscription avec meilleure gestion d'erreur
    enrollStudent: async (_, { courseId, studentId }) => {
      try {
        console.log(`🎯 GraphQL - Inscription: étudiant ${studentId} au cours ${courseId}`);
        
        const payload = {
          student_id: parseInt(studentId),
          course_id: parseInt(courseId)
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
          
          if (status === 404) {
            errorMessage = "❌ Route non trouvée. Vérifiez l'URL.";
          } else if (data && data.error) {
            errorMessage = `❌ ${data.error}`;
          } else {
            errorMessage = `❌ Erreur ${status}`;
          }
        } else if (error.code === 'ECONNREFUSED') {
          errorMessage = "❌ Impossible de se connecter à Django.";
        }

        return {
          success: false,
          message: errorMessage,
          enrollment: null
        };
      }
    }
  },

  // ✅ RELATIONS - UN SEUL resolver par type
  Student: {
    courses: async (parent) => {
      try {
        const studentId = parent.id;
        const response = await courseClient.get(`/student/${studentId}/courses/`);
        return response.data.map(course => ({
          id: course.id,
          name: course.name,
          instructor: course.instructor,
          category: course.category,
          schedule: course.schedule
        }));
      } catch (error) {
        console.error("Erreur récupération cours étudiant:", error.message);
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

        // ✅ Format cohérent avec courseStudents
        return response.data.students.map(student => ({
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          email: student.email,
          university: student.university || null
        }));

      } catch (error) {
        console.error("Erreur récupération étudiants cours:", error.message);
        return [];
      }
    }
  }
};