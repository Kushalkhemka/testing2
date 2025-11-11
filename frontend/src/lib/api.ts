import axios, { AxiosInstance, AxiosResponse } from 'axios';
import type { ApiResponse, AuthResponse, LoginCredentials, RegisterData, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth APIs
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/login', credentials);
    return response.data.data!;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.client.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return response.data.data!;
  }

  async getProfile(): Promise<User> {
    const response = await this.client.get<ApiResponse<User>>('/auth/profile');
    return response.data.data!;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.put<ApiResponse<User>>('/auth/profile', data);
    return response.data.data!;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  // Question APIs
  async getQuestions(params?: any) {
    const response = await this.client.get('/questions', { params });
    return response.data;
  }

  async getQuestion(id: string) {
    const response = await this.client.get(`/questions/${id}`);
    return response.data;
  }

  async createQuestion(data: any) {
    const response = await this.client.post('/questions', data);
    return response.data;
  }

  async updateQuestion(id: string, data: any) {
    const response = await this.client.put(`/questions/${id}`, data);
    return response.data;
  }

  async deleteQuestion(id: string) {
    const response = await this.client.delete(`/questions/${id}`);
    return response.data;
  }

  async getSubjects() {
    const response = await this.client.get('/questions/meta/subjects');
    return response.data;
  }

  async getTopics(subject?: string) {
    const response = await this.client.get('/questions/meta/topics', {
      params: { subject },
    });
    return response.data;
  }

  // Exam APIs
  async getExams(params?: any) {
    const response = await this.client.get('/exams', { params });
    return response.data;
  }

  async getExam(id: string) {
    const response = await this.client.get(`/exams/${id}`);
    return response.data;
  }

  async createExam(data: any) {
    const response = await this.client.post('/exams', data);
    return response.data;
  }

  async updateExam(id: string, data: any) {
    const response = await this.client.put(`/exams/${id}`, data);
    return response.data;
  }

  async deleteExam(id: string) {
    const response = await this.client.delete(`/exams/${id}`);
    return response.data;
  }

  async addQuestionsToExam(examId: string, questions: any[]) {
    const response = await this.client.post(`/exams/${examId}/questions`, { questions });
    return response.data;
  }

  async createExamSchedule(examId: string, data: any) {
    const response = await this.client.post(`/exams/${examId}/schedules`, data);
    return response.data;
  }

  async getExamSchedules(examId: string) {
    const response = await this.client.get(`/exams/${examId}/schedules`);
    return response.data;
  }

  async publishExam(examId: string) {
    const response = await this.client.post(`/exams/${examId}/publish`);
    return response.data;
  }

  // Exam Attempt APIs
  async startExamAttempt(data: any) {
    const response = await this.client.post('/attempts/start', data);
    return response.data;
  }

  async getAttempt(attemptId: string) {
    const response = await this.client.get(`/attempts/${attemptId}`);
    return response.data;
  }

  async submitAnswer(attemptId: string, data: any) {
    const response = await this.client.post(`/attempts/${attemptId}/answers`, data);
    return response.data;
  }

  async submitExam(attemptId: string, timeRemaining: number) {
    const response = await this.client.post(`/attempts/${attemptId}/submit`, {
      time_remaining_seconds: timeRemaining,
    });
    return response.data;
  }

  async getStudentAttempts(examId: string) {
    const response = await this.client.get(`/attempts/exam/${examId}/student`);
    return response.data;
  }

  // Proctoring APIs
  async recordProctoringEvent(data: any) {
    const response = await this.client.post('/proctoring/events', data);
    return response.data;
  }

  async getProctoringEvents(attemptId: string) {
    const response = await this.client.get(`/proctoring/events/attempt/${attemptId}`);
    return response.data;
  }

  async getProctoringReport(attemptId: string) {
    const response = await this.client.get(`/proctoring/report/attempt/${attemptId}`);
    return response.data;
  }

  // Report APIs
  async getStudentReport(studentId: string, examId: string) {
    const response = await this.client.get(`/reports/student/${studentId}/exam/${examId}`);
    return response.data;
  }

  async getClassReport(examId: string) {
    const response = await this.client.get(`/reports/class/exam/${examId}`);
    return response.data;
  }

  async getDashboardAnalytics() {
    const response = await this.client.get('/reports/dashboard');
    return response.data;
  }

  // Import/Export APIs
  async importQuestions(file: File, format: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const response = await this.client.post('/import-export/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async exportQuestions(data: any) {
    const response = await this.client.post('/import-export/export', data, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadTemplate(format: string) {
    const response = await this.client.get('/import-export/template', {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }
}

export const api = new ApiClient();
export default api;
