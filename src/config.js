import dotenv from "dotenv";
dotenv.config();

export const STUDENT_URL = process.env.STUDENT_URL;
export const COURSE_URL = process.env.COURSE_URL;
export const PORT = process.env.PORT || 4000;
