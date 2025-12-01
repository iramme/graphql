import axios from "axios";
import DataLoader from "dataloader";
import { STUDENT_URL, COURSE_URL } from "./config.js";

// Clients HTTP
const studentClient = axios.create({
  baseURL: STUDENT_URL,
  timeout: 10000
});

const courseClient = axios.create({
  baseURL: COURSE_URL,
  timeout: 10000
});

// DataLoader simplifié
export function createCoursesLoader() {
  return new DataLoader(async (studentIds) => {
    try {
      // Récupérer tous les cours
      const response = await courseClient.get("/api/courses/");
      const allCourses = response.data || [];
      
      // Simuler le mapping étudiant -> cours
      return studentIds.map(studentId => {
        return allCourses
          .filter(course => {
            // Adaptez cette logique selon votre structure de données
            return course.students && course.students.includes(parseInt(studentId));
          })
          .map(course => ({
            id: course.id,
            name: course.name,
            instructor: course.instructor,
            category: course.category,
            schedule: course.schedule
          }));
      });
    } catch (error) {
      console.error("DataLoader error:", error.message);
      return studentIds.map(() => []);
    }
  }, { cache: true });
}

export const resolvers = {
  Query: {
    // ✅ SUPPRIMER health si vous ne voulez pas de health check
    
    students: async () => {
      try {
        const res = await studentClient.get("/api/students");
        return res.data.map(s => ({
          id: s.id,
          first_name: s.first_name || s.firstName,
          last_name: s.last_name || s.lastName,
          email: s.email,
        }));
      } catch (error) {
        console.error("Error fetching students:", error.message);
        throw new Error("Failed to fetch students");
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
        throw new Error(`Student ${id} not found`);
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
        console.error("Error fetching courses:", error.message);
        throw new Error("Failed to fetch courses");
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
        throw new Error(`Course ${id} not found`);
      }
    },

    courseStudents: async (_, { courseId }) => {
      try {
        // Essayer de récupérer directement du service Course
        const response = await courseClient.get(`/api/courses/${courseId}`);
        const course = response.data;
        
        // Si le cours contient des IDs d'étudiants
        if (course.students && Array.isArray(course.students)) {
          return course.students.map(studentId => ({
            id: studentId,
            first_name: `Student ${studentId}`,
            last_name: "Doe",
            email: `student${studentId}@example.com`
          }));
        }
        
        return [];
      } catch (error) {
        console.error("Error fetching course students:", error.message);
        return [];
      }
    },
  },

  Mutation: {
    enrollStudent: async (_, { courseId, studentId }) => {
      try {
        console.log(`Inscription: étudiant ${studentId} au cours ${courseId}`);
        
        const payload = {
          student_id: parseInt(studentId),
          course_id: parseInt(courseId)
        };
        
        const response = await courseClient.post("/enroll/", payload, {
          timeout: 15000
        });
        
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
        console.error("Enrollment error:", error.message);
        
        return {
          success: false,
          message: error.response?.data?.error || "Échec de l'inscription",
          enrollment: null
        };
      }
    }
  },

  Student: {
    courses: async (parent, _, { loaders }) => {
      try {
        return await loaders.coursesLoader.load(parent.id);
      } catch (error) {
        console.error(`Error loading courses for student ${parent.id}:`, error.message);
        return [];
      }
    },
  },

  Course: {
    students: async (parent) => {
      try {
        const response = await courseClient.get(`/api/courses/${parent.id}`);
        const course = response.data;
        
        if (course.students && Array.isArray(course.students)) {
          return course.students.map(studentId => ({
            id: studentId,
            first_name: `Student ${studentId}`,
            last_name: "Doe",
            email: `student${studentId}@example.com`
          }));
        }
        
        return [];
      } catch (error) {
        console.error(`Error loading students for course ${parent.id}:`, error.message);
        return [];
      }
    }
  }
};