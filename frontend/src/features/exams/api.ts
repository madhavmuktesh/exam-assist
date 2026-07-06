// frontend/src/features/exam/api.ts
import api from "@/lib/apiClient";

export interface ExamConfig {
  title: string;
  total_mcq: number;
  total_descriptive: number;
  duration_minutes: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface UploadPdfResponse {
  pipeline_id: string;
}

export async function uploadSourcePdf(file: File, mode: "content" | "questions") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const res = await api.post<UploadPdfResponse>("/pipeline/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function generateQuestions(pipelineId: string, config: ExamConfig) {
  const res = await api.post("/questions/generate", {
    pipeline_id: pipelineId,
    ...config,
  });
  return res.data; // exam_id or questions[]
}

export async function createExamFromQuestions(payload: {
  title: string;
  questions: any[];
  duration_minutes: number;
}) {
  const res = await api.post("/exams/", payload);
  return res.data;
}

export async function getExam(examId: string) {
  const res = await api.get(`/exams/${examId}`);
  return res.data;
}

export async function submitResponses(examId: string, answers: Record<string, any>) {
  const res = await api.post(`/responses/${examId}`, { answers });
  return res.data;
}

export async function getExamHistory() {
  const res = await api.get("/history");
  return res.data;
}