import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  // Parse initial value
  const parsedTime = parseTimeString(value);
  
  const [hour, setHour] = useState<string>(parsedTime.hour);
  const [minute, setMinute] = useState<string>(parsedTime.minute);
  const [isPM, setIsPM] = useState<boolean>(parsedTime.isPM);

  // Generate hour options (01-12)
  const hours = Array.from({ length: 12 }, (_, i) => {
    return (i + 1).toString().padStart(2, "0");
  });

  // Generate minute options (00-59)
  const minutes = Array.from({ length: 60 }, (_, i) => {
    return i.toString().padStart(2, "0");
  });

  const handleHourChange = (newHour: string) => {
    setHour(newHour);
    updateTime(newHour, minute, isPM);
  };

  const handleMinuteChange = (newMinute: string) => {
    setMinute(newMinute);
    updateTime(hour, newMinute, isPM);
  };

  const handleAmPmChange = (checked: boolean) => {
    setIsPM(checked);
    updateTime(hour, minute, checked);
  };

  const updateTime = (h: string, m: string, pm: boolean) => {
    const period = pm ? "PM" : "AM";
    onChange(`${h}:${m} ${period}`);
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Clock className="h-4 w-4 opacity-70" />
      
      <Select value={hour} onValueChange={handleHourChange}>
        <SelectTrigger className="w-[70px]">
          <SelectValue placeholder="Hour" />
        </SelectTrigger>
        <SelectContent>
          {hours.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <span>:</span>
      
      <Select value={minute} onValueChange={handleMinuteChange}>
        <SelectTrigger className="w-[70px]">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {minutes.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <div className="flex items-center space-x-2">
        <Label htmlFor="am-pm-switch" className={isPM ? "opacity-40" : "opacity-100"}>
          AM
        </Label>
        <Switch
          id="am-pm-switch"
          checked={isPM}
          onCheckedChange={handleAmPmChange}
        />
        <Label htmlFor="am-pm-switch" className={isPM ? "opacity-100" : "opacity-40"}>
          PM
        </Label>
      </div>
    </div>
  );
}

// Helper function to parse a time string like "09:30 AM"
function parseTimeString(timeString: string) {
  const defaultResult = { hour: "09", minute: "00", isPM: false };
  
  if (!timeString) return defaultResult;
  
  const match = timeString.match(/^(\d{1,2}):(\d{1,2}) (AM|PM)$/);
  if (!match) return defaultResult;
  
  const [, hour, minute, period] = match;
  
  return {
    hour: hour.padStart(2, "0"),
    minute: minute.padStart(2, "0"),
    isPM: period === "PM",
  };
}