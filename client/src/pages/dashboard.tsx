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
import { Loader2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: profile, isLoading: isLoadingProfile } = useQuery<StudentProfile>({
    queryKey: ["/api/profile"],
    onError: (error: Error) => {
      toast({
        title: "Error loading profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: questions, isLoading: isLoadingQuestions } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    onError: (error: Error) => {
      toast({
        title: "Error loading questions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/auth");
  };

  if (isLoadingProfile || isLoadingQuestions) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile || !questions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-gray-600">
                No profile found. Please set up your learning profile first.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const subjectDisplay = profile.subject.charAt(0).toUpperCase() + profile.subject.slice(1);
  const today = format(new Date(), "EEEE, MMMM do");
  const isTrialActive = user?.trialEndsAt && new Date(user.trialEndsAt) > new Date();
  const trialEndsDate = user?.trialEndsAt ? format(new Date(user.trialEndsAt), "MMMM do") : null;

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

        {!user?.isSubscribed && isTrialActive && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <p className="text-orange-800">
                Trial period active - ends on {trialEndsDate}. 
                <Button 
                  variant="link" 
                  className="text-orange-800 underline p-0 ml-2"
                  onClick={() => setLocation("/subscribe")}
                >
                  Subscribe now
                </Button>
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{subjectDisplay} - Year {profile.grade}</CardTitle>
            <CardDescription>
              Today's learning questions. Click on each question to see the answer and explanation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-4">
              {questions.map((question, index) => (
                <AccordionItem key={question.id} value={`question-${index}`}>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
