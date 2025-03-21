import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertProfileSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import type { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const subjects = [
  { id: "math", label: "Mathematics" },
  { id: "english", label: "English" },
] as const;

const timeOptions = Array.from({ length: 12 }, (_, i) => {
  const hour = (i + 1).toString().padStart(2, '0');
  return [
    `${hour}:00 AM`,
    `${hour}:30 AM`,
    `${hour}:00 PM`,
    `${hour}:30 PM`,
  ];
}).flat();

export default function HomePage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const form = useForm<z.infer<typeof insertProfileSchema>>({
    resolver: zodResolver(insertProfileSchema),
    defaultValues: {
      childName: "",
      subjects: [],
      grade: undefined,
      preferredEmailTime: "09:00 AM",
    },
  });

  const onSubmit = async (data: z.infer<typeof insertProfileSchema>) => {
    try {
      await apiRequest("POST", "/api/profile", data);
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error creating profile",
        description: error.response?.data?.error || "Failed to create profile",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!user) {
      setLocation("/auth");
      return;
    }

    if (profile) {
      setLocation("/dashboard");
    } else if (!user.isSubscribed && !user.trialEndsAt) {
      setLocation("/subscribe");
    }
  }, [profile, user, setLocation]);

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Setup Your Child's Learning Profile</CardTitle>
              <CardDescription>
                Choose your child's grade, preferred subjects, and daily email time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  <FormField
                    control={form.control}
                    name="childName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Child's Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your child's name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grade Level</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your child's grade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((grade) => (
                              <SelectItem key={grade} value={grade.toString()}>
                                Year {grade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preferredEmailTime"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Preferred Daily Email Time</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  field.value
                                ) : (
                                  <span>Pick a time</span>
                                )}
                                <Clock className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="grid grid-cols-1 gap-1 p-2 max-h-[300px] overflow-y-auto">
                              {timeOptions.map((time) => (
                                <Button
                                  key={time}
                                  onClick={() => {
                                    field.onChange(time);
                                    form.setValue("preferredEmailTime", time);
                                  }}
                                  variant={field.value === time ? "default" : "ghost"}
                                  className="justify-start font-normal"
                                >
                                  {time}
                                </Button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          Choose when you'd like to receive daily practice questions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subjects"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel>Subjects</FormLabel>
                        </div>
                        <div className="grid gap-4">
                          {subjects.map((subject) => (
                            <FormField
                              key={subject.id}
                              control={form.control}
                              name="subjects"
                              render={({ field }) => (
                                <FormItem
                                  key={subject.id}
                                  className="flex flex-row items-start space-x-3 space-y-0"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(subject.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...(field.value || []), subject.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== subject.id
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal">
                                    {subject.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full">
                    Start Learning
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}