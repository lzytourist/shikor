"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ShikorLogo } from "@/components/brand/shikor-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { type SignInValues, signInSchema } from "@/lib/validations/auth";

interface LoginFormProps {
  callbackUrl?: string;
  isGoogleEnabled?: boolean;
}

const LoginForm = ({
  callbackUrl = "/trees",
  isGoogleEnabled = false,
}: LoginFormProps) => {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  const onSubmit = async (values: SignInValues) => {
    setServerError(null);
    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
      rememberMe: values.rememberMe ?? true,
      callbackURL: callbackUrl,
    });

    if (error) {
      const message = error.message || "Invalid email or password.";
      setServerError(message);
      toast.error(message);
      return;
    }

    toast.success("Welcome back to Shikor!");
    router.push(callbackUrl);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    if (!isGoogleEnabled) {
      toast.info(
        "Google Sign-In is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable it.",
      );
      return;
    }

    setServerError(null);
    setIsGoogleLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: callbackUrl,
    });

    if (error) {
      setIsGoogleLoading(false);
      const message = error.message || "Could not start Google Sign-In.";
      setServerError(message);
      toast.error(message);
    }
  };

  return (
    <section className="bg-muted/40 dark:bg-background min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="py-10 md:py-16 max-w-lg px-4 sm:px-0 mx-auto w-full relative z-10">
        <Card className="max-w-lg px-6 py-8 sm:p-10 relative gap-6 shadow-lg border-border/70">
          <CardHeader className="text-center gap-5 p-0">
            <div className="mx-auto">
              <ShikorLogo size="lg" />
            </div>
            <div className="flex flex-col gap-1.5">
              <CardTitle className="text-2xl font-semibold text-card-foreground">
                Welcome back to Shikor
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground font-normal">
                Sign in to explore and collaborate on your family trees
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <FieldGroup className="gap-5">
                {serverError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{serverError}</span>
                  </div>
                )}

                <Field>
                  <Button
                    variant="outline"
                    type="button"
                    disabled={isSubmitting || isGoogleLoading}
                    onClick={handleGoogleSignIn}
                    className="w-full text-sm font-medium text-card-foreground gap-2.5 dark:bg-background rounded-lg h-10 cursor-pointer"
                  >
                    {isGoogleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                      >
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94Z"
                        />
                      </svg>
                    )}
                    Continue with Google
                  </Button>
                </Field>

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card text-xs text-muted-foreground bg-transparent">
                  <span className="px-3">or continue with email</span>
                </FieldSeparator>

                <div className="flex flex-col gap-4">
                  <Field className="gap-1.5" data-invalid={!!errors.email}>
                    <FieldLabel htmlFor="email" className="text-sm font-medium">
                      Email address
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="john@mail.app"
                      aria-invalid={!!errors.email}
                      className="dark:bg-background h-10 rounded-md"
                      {...register("email")}
                    />
                    {errors.email && (
                      <FieldError>{errors.email.message}</FieldError>
                    )}
                  </Field>

                  <Field className="gap-1.5" data-invalid={!!errors.password}>
                    <FieldLabel
                      htmlFor="password"
                      className="text-sm font-medium"
                    >
                      Password
                    </FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      aria-invalid={!!errors.password}
                      className="dark:bg-background h-10 rounded-md"
                      {...register("password")}
                    />
                    {errors.password && (
                      <FieldError>{errors.password.message}</FieldError>
                    )}
                  </Field>
                </div>

                <Field orientation="horizontal" className="justify-between">
                  <div className="flex items-center gap-2.5">
                    <Controller
                      control={control}
                      name="rememberMe"
                      render={({ field }) => (
                        <Checkbox
                          id="rememberMe"
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(Boolean(checked))
                          }
                          className="cursor-pointer"
                        />
                      )}
                    />
                    <FieldLabel
                      htmlFor="rememberMe"
                      className="text-sm text-muted-foreground font-normal cursor-pointer"
                    >
                      Remember this device
                    </FieldLabel>
                  </div>
                </Field>

                <Field className="gap-4">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || isGoogleLoading}
                    className="rounded-lg h-10 cursor-pointer w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                  <FieldDescription className="text-center text-sm font-normal text-muted-foreground">
                    New to Shikor?{" "}
                    <Link
                      href="/sign-up"
                      className="font-medium text-primary hover:underline"
                    >
                      Create an account
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default LoginForm;
