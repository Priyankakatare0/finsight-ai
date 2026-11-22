import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerFormSchema, type RegisterFormValues } from "../validators/auth";
import { authApi } from "../services/authApi";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import axios from "axios";

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      setServerError(null);
      const data = await authApi.register({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      setAuth(data.user, data.accessToken);
      navigate("/documents", { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          "Failed to register. Please check your information.";
        setServerError(message);
      } else {
        setServerError("An unexpected error occurred. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Create an Account
          </h1>
          <p className="text-sm text-slate-400">
            Get started with FinSight AI analysis and reports
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="p-3.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-start space-x-2">
                <span className="font-bold">Error:</span>
                <span>{serverError}</span>
              </div>
            )}

            <Input
              id="name"
              label="Full Name"
              type="text"
              placeholder="Alice Johnson"
              error={errors.name?.message}
              {...register("name")}
            />

            <Input
              id="email"
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              id="password"
              label="Password (min. 8 characters)"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register("password")}
            />

            <Input
              id="confirmPassword"
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              isLoading={isSubmitting}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-400 hover:text-blue-300 underline underline-offset-4"
              >
                Sign in instead
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;

