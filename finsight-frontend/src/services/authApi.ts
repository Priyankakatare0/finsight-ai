import api from "../lib/axios";
import type { AuthResponse, UserMeResponse } from "../types/auth";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse["data"]> {
    const { data } = await api.post<AuthResponse>("/auth/register", payload);
    return data.data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse["data"]> {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return data.data;
  },

  async refresh(): Promise<AuthResponse["data"]> {
    const { data } = await api.post<AuthResponse>("/auth/refresh", {});
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post("/auth/logout", {});
  },

  async getMe(): Promise<UserMeResponse["data"]["user"]> {
    const { data } = await api.get<UserMeResponse>("/users/me");
    return data.data.user;
  },
};

export default authApi;

