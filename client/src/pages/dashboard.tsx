import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Question, StudentProfile } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, LogOut, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: profile, isLoading: isLoadingProfile } = useQuery<StudentProfile>({
    queryKey: ["/api/profile"],
  });

  const { data: questionsBySubject, isLoading: isLoadingQuestions } = useQuery<Record<string, Question[]>>({
    queryKey: ["/api/questions"],
    enabled: !!profile, // Only fetch questions if profile exists
    onError: (error: any) => {
      toast({
        title: "Error loading questions",
        description: error.response?.data?.error || "Failed to load your daily questions",
        variant: "destructive",
      });
    }
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate("/auth");
  };

  const handleSubscribe = () => {
    navigate("/subscribe");
  };

  if (isLoadingProfile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to profile setup if no profile exists
  if (!profile) {
    navigate("/");
    return null;
  }

  // Show loading state while fetching questions
  if (isLoadingQuestions) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const subjectsDisplay = profile.subjects.map(s =>
    s.charAt(0).toUpperCase() + s.slice(1)
  ).join(", ");

  const today = format(new Date(), "EEEE, MMMM do");
  const isTrialActive = user?.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  const trialEndsDate = user?.trialEndsAt ? format(new Date(user.trialEndsAt), "MMMM do") : null;
  const hasActiveSubscription = user?.isSubscribed && user?.stripeSubscriptionId && user.stripeCustomerId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Daily Questions</h1>
            <p className="text-gray-600">{today}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        {/* Subscription Status */}
        {hasActiveSubscription ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-green-800">
                  Active Subscription - Enjoy unlimited access to all learning materials!
                </p>
              </div>
            </CardContent>
          </Card>
        ) : user?.stripeSubscriptionId && !hasActiveSubscription ? (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-yellow-800">
                Subscription payment pending. Please complete your payment to access all features.
              </p>
              <Button
                variant="default"
                onClick={handleSubscribe}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Complete Subscription
              </Button>
            </CardContent>
          </Card>
        ) : isTrialActive ? (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-orange-800">
                Trial period active - ends on {trialEndsDate}
              </p>
              <Button
                variant="default"
                onClick={handleSubscribe}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Subscribe Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4 flex items-center justify-between">
              <p className="text-red-800">
                Trial period has ended. Subscribe to continue learning.
              </p>
              <Button
                variant="default"
                onClick={handleSubscribe}
                className="bg-red-600 hover:bg-red-700"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Subscribe Now
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Year {profile.grade} - Daily Questions</CardTitle>
            <CardDescription>
              Today's learning questions for {subjectsDisplay}. Click on each question to see the answer and explanation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {questionsBySubject && Object.entries(questionsBySubject).map(([subject, questions]) => (
              <div key={subject} className="mb-8 last:mb-0">
                <h2 className="text-xl font-semibold mb-4 text-primary">
                  {subject.charAt(0).toUpperCase() + subject.slice(1)}
                </h2>
                <Accordion type="single" collapsible className="space-y-4">
                  {questions.map((question, index) => (
                    <AccordionItem key={question.id} value={`${subject}-question-${index}`}>
                      <AccordionTrigger className="text-left">
                        <span className="font-medium">
                          Question {index + 1}: {question.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-2">
                        <div>
                          <strong className="text-primary">Answer:</strong>
                          <p className="mt-1">{question.answer}</p>
                        </div>
                        {question.explanation && (
                          <>
                            <Separator className="my-2" />
                            <div>
                              <strong className="text-primary">Explanation:</strong>
                              <p className="mt-1">{question.explanation}</p>
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}