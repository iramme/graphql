export const typeDefs = `#graphql
  type Student {
    id: ID!
    first_name: String
    last_name: String
    email: String
    courses: [Course]
  }

  type Course {
  id: ID!
  name: String!
  instructor: String
  category: String
  schedule: String
  students: [Student]
}

  type Query {
    students: [Student]
    student(id: ID!): Student
    courses: [Course]
    course(id: ID!): Course
    courseStudents(courseId: ID!): [Student]
  }

 type Mutation {
    # 🔥 NOUVELLE MUTATION : Inscription
    enrollStudent(courseId: ID!, studentId: ID!): EnrollmentResult
  }

  type EnrollmentResult {
    success: Boolean!
    message: String!
    enrollment: Enrollment
  }

  type Enrollment {
    id: ID!
    student: Student
    course: Course
  }
`;
