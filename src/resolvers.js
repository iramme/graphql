import axios from "axios";
import DataLoader from "dataloader";
import { STUDENT_URL, COURSE_URL } from "./config.js";

// ✅ Clients HTTP avec configuration correcte
const studentClient = axios.create({
  baseURL: STUDENT_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

const courseClient = axios.create({
  baseURL: COURSE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// ✅ DataLoader CORRIGÉ - Utiliser le bon endpoint
export function createCoursesLoader() {
  return new DataLoader(async (studentIds) => {
    console.log(`📚 DataLoader - Chargement cours pour étudiants: ${studentIds}`);
    
    try {
      // Demander TOUS les cours d'un coup au service Course
      const response = await courseClient.get("/api/courses/");
      const allCourses = response.data;
      
      // Simuler un mapping étudiant -> cours (à adapter selon votre API)
      return studentIds.map(studentId => {
        // Filtre les cours pour cet étudiant
        // ⚠️ ADAPTER cette logique selon votre structure de données
        const studentCourses = allCourses.filter(course => 
          course.students && course.students.includes(parseInt(studentId))
        );
        
        return studentCourses.map(course => ({
          id: course.id,
          name: course.name,
          instructor: course.instructor,
          category: course.category,
          schedule: course.schedule
        }));
      });
    } catch (error) {
      console.error("❌ DataLoader error:", error.message);
      return studentIds.map(() => []);
    }
  }, { cache: true });
}

export const resolvers = {
  Query: {
    health: () => ({
      status: "OK",
      timestamp: new Date().toISOString(),
      services: {
        student: STUDENT_URL,
        course: COURSE_URL
      }
    }),

    // ✅ STUDENTS - Utiliser le service Student
    students: async () => {
      try {
        console.log(`📡 Récupération étudiants depuis: ${STUDENT_URL}/api/students`);
        const res = await studentClient.get("/api/students");
        return res.data.map(s => ({
          id: s.id,
          first_name: s.first_name || s.firstName,
          last_name: s.last_name || s.lastName,
          email: s.email,
        }));
      } catch (error) {
        console.error("❌ Error fetching students:", error.message);
        throw new Error(`Failed to fetch students: ${error.message}`);
      }
    },

    student: async (_, { id }) => {
      try {
        const res = await studentClient.get(`/api/students/${id}`);
        const s = res.data;
        return {
          id: s.id,
          first_name: s.first_name || s.firstName,
          last_name: s.last_name || s.lastName,
          email: s.email,
        };
      } catch (error) {
        throw new Error(`Student ${id} not found: ${error.message}`);
      }
    },

    // ✅ COURSES - Utiliser le service Course
    courses: async () => {
      try {
        console.log(`📡 Récupération cours depuis: ${COURSE_URL}/api/courses`);
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
        throw new Error(`Failed to fetch courses: ${error.message}`);
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
        throw new Error(`Course ${id} not found: ${error.message}`);
      }
    },

    // ✅ CORRIGÉ - Utiliser le bon endpoint
    courseStudents: async (_, { courseId }) => {
      try {
        console.log(`🎯 Récupération étudiants du cours ${courseId}`);
        
        // Option 1: Si votre API Course a cet endpoint
        try {
          const response = await courseClient.get(`/api/courses/${courseId}/students/`);
          return response.data.map(student => ({
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            email: student.email,
          }));
        } catch (error) {
          // Option 2: Récupérer d'abord le cours, puis les étudiants via le service Student
          const courseResponse = await courseClient.get(`/api/courses/${courseId}`);
          const course = courseResponse.data;
          
          // Si le cours contient des IDs d'étudiants
          if (course.students && Array.isArray(course.students)) {
            // Récupérer les détails des étudiants
            const studentPromises = course.students.map(studentId =>
              studentClient.get(`/api/students/${studentId}`)
                .then(r => r.data)
                .catch(() => null)
            );
            
            const students = await Promise.all(studentPromises);
            return students.filter(s => s !== null).map(s => ({
              id: s.id,
              first_name: s.first_name || s.firstName,
              last_name: s.last_name || s.lastName,
              email: s.email,
            }));
          }
          
          return [];
        }
      } catch (error) {
        console.error("❌ Error fetching course students:", error.message);
        return [];
      }
    },
  },

  Mutation: {
    // ✅ CORRIGÉ - Mutation simplifiée
    enrollStudent: async (_, { courseId, studentId }) => {
      try {
        console.log(`🎯 Inscription: étudiant ${studentId} au cours ${courseId}`);
        
        // ✅ OPTION A: Envoyer directement au service Course
        // (Le service Course doit gérer la validation lui-même)
        const payload = {
          student_id: parseInt(studentId),
          course_id: parseInt(courseId)
        };
        
        console.log("📦 Payload:", payload);
        console.log("📡 Envoi à:", `${COURSE_URL}/enroll/`);
        
        const response = await courseClient.post("/enroll/", payload, {
          timeout: 20000
        });
        
        console.log("✅ Réponse:", response.data);
        
        return {
          success: true,
          message: response.data.message || "Inscription réussie",
          enrollment: {
            id: Date.now().toString(),
            student: { id: studentId },
            course: { id: courseId }
          }
        };
        
      } catch (error) {
        console.error("❌ Erreur inscription:", {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          data: error.response?.data
        });
        
        let errorMessage = "Erreur lors de l'inscription";
        
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.code === 'ECONNREFUSED') {
          errorMessage = "Service Course inaccessible";
        } else if (error.code === 'ETIMEDOUT') {
          errorMessage = "Timeout - Service Course trop lent à répondre";
        }
        
        return {
          success: false,
          message: errorMessage,
          enrollment: null
        };
      }
    }
  },

  // ✅ CORRIGÉ - Relations
  Student: {
    courses: async (parent, _, { loaders }) => {
      try {
        // Utiliser le DataLoader
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
        // Utiliser la même logique que courseStudents
        const response = await courseClient.get(`/api/courses/${parent.id}`);
        const course = response.data;
        
        if (course.students && Array.isArray(course.students)) {
          const studentPromises = course.students.map(studentId =>
            studentClient.get(`/api/students/${studentId}`)
              .then(r => r.data)
              .catch(() => null)
          );
          
          const students = await Promise.all(studentPromises);
          return students.filter(s => s !== null).map(s => ({
            id: s.id,
            first_name: s.first_name || s.firstName,
            last_name: s.last_name || s.lastName,
            email: s.email,
          }));
        }
        
        return [];
      } catch (error) {
        console.error(`Erreur récupération étudiants cours ${parent.id}:`, error.message);
        return [];
      }
    }
  }
};