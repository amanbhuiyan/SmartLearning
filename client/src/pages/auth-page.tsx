import { useEffect } from "react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema, loginSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HeroIllustration } from "@/components/ui/hero-illustration";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { GraduationCap, Sparkles, BookOpen, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

const registerFormSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <motion.div
    className="flex items-start gap-4 p-4 rounded-xl bg-white/50 backdrop-blur-sm border border-primary/10 hover:border-primary/20 transition-all"
    whileHover={{ scale: 1.02 }}
    {...fadeIn}
  >
    <div className="bg-primary/10 p-3 rounded-lg">
      <Icon className="h-6 w-6 text-primary" />
    </div>
    <div>
      <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  </motion.div>
);

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  useEffect(() => {
    if (user) {
      if (!profile) {
        setLocation("/");
        return;
      }
      setLocation("/dashboard");
    }
  }, [user, profile, setLocation]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerFormSchema>>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const handleLoginError = (error: any) => {
    toast({
      variant: "destructive",
      title: "Login Failed",
      description: error.response?.data?.message || "Please check your credentials and try again",
    });
  };

  const handleRegisterError = (error: any) => {
    toast({
      variant: "destructive",
      title: "Registration Failed",
      description: error.response?.data?.message || "Could not create your account. Please try again.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left side - Branding and Features */}
          <motion.div 
            className="space-y-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div 
              className="space-y-4"
              {...fadeIn}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                >
                  <GraduationCap className="h-12 w-12 text-primary" />
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 text-transparent bg-clip-text">
                  EduQuest
                </h1>
              </div>
              <p className="text-xl md:text-2xl font-medium text-gray-700">
                Your Child's Daily Learning Adventure
              </p>
              <p className="text-gray-600 text-lg">
                Personalized learning experiences that make education fun and engaging.
                Start with a free week trial, then just £2/week.
              </p>
            </motion.div>

            {/* Hero Illustration */}
            <div className="hidden lg:block">
              <HeroIllustration />
            </div>

            {/* Feature List */}
            <motion.div 
              className="grid gap-4"
              variants={{
                initial: { opacity: 0 },
                animate: { opacity: 1, transition: { staggerChildren: 0.1 } }
              }}
              initial="initial"
              animate="animate"
            >
              <FeatureCard
                icon={BookOpen}
                title="Daily Learning Materials"
                description="Fresh questions every day in Math and English"
              />
              <FeatureCard
                icon={Users}
                title="Personalized Experience"
                description="Content tailored to your child's grade level"
              />
              <FeatureCard
                icon={Sparkles}
                title="Engaging Content"
                description="Interactive questions that make learning fun"
              />
            </motion.div>
          </motion.div>

          {/* Right side - Auth Form */}
          <motion.div 
            className="lg:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <Card className="w-full backdrop-blur-sm bg-white/90">
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold text-center">Welcome to EduQuest</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="register">Register</TabsTrigger>
                  </TabsList>
                  <TabsContent value="login">
                    <Form {...loginForm}>
                      <form
                        onSubmit={loginForm.handleSubmit(
                          data => loginMutation.mutateAsync({ email: data.email, password: data.password }).catch(handleLoginError)
                        )}
                        className="space-y-4"
                      >
                        <FormField
                          control={loginForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} className="bg-white/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} className="bg-white/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? "Logging in..." : "Login"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                  <TabsContent value="register">
                    <Form {...registerForm}>
                      <form
                        onSubmit={registerForm.handleSubmit(
                          data => registerMutation.mutateAsync(data).catch(handleRegisterError)
                        )}
                        className="space-y-4"
                      >
                        <FormField
                          control={registerForm.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>First Name</FormLabel>
                              <FormControl>
                                <Input {...field} className="bg-white/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Last Name</FormLabel>
                              <FormControl>
                                <Input {...field} className="bg-white/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" {...field} className="bg-white/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} className="bg-white/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? "Creating account..." : "Create Account"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}