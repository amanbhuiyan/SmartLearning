import { FC } from "react";

export const HeroIllustration: FC = () => {
  return (
    <svg
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-2xl mx-auto"
    >
      {/* Background Shapes */}
      <circle cx="400" cy="300" r="250" fill="#E0E7FF" fillOpacity="0.5" />
      <circle cx="400" cy="300" r="200" fill="#C7D2FE" fillOpacity="0.5" />
      
      {/* Books Stack */}
      <path
        d="M300 350 L500 350 L480 200 L320 200 Z"
        fill="#4F46E5"
        opacity="0.9"
      />
      <path
        d="M320 200 L480 200 L460 150 L340 150 Z"
        fill="#6366F1"
        opacity="0.8"
      />
      <path
        d="M340 150 L460 150 L440 100 L360 100 Z"
        fill="#818CF8"
        opacity="0.7"
      />

      {/* Graduation Cap */}
      <path
        d="M380 50 L420 50 L440 70 L360 70 Z"
        fill="#4F46E5"
      />
      <path
        d="M360 70 L440 70 L400 90 Z"
        fill="#6366F1"
      />
      <line
        x1="400"
        y1="90"
        x2="400"
        y2="120"
        stroke="#4F46E5"
        strokeWidth="4"
      />

      {/* Mathematical Symbols */}
      <text x="280" y="280" fill="#4F46E5" fontSize="24" fontWeight="bold">+</text>
      <text x="320" y="320" fill="#6366F1" fontSize="24" fontWeight="bold">÷</text>
      <text x="460" y="290" fill="#818CF8" fontSize="24" fontWeight="bold">×</text>
      <text x="500" y="330" fill="#4F46E5" fontSize="24" fontWeight="bold">=</text>

      {/* ABC Letters */}
      <text x="350" y="400" fill="#4F46E5" fontSize="32" fontWeight="bold">A</text>
      <text x="400" y="400" fill="#6366F1" fontSize="32" fontWeight="bold">B</text>
      <text x="450" y="400" fill="#818CF8" fontSize="32" fontWeight="bold">C</text>

      {/* Decorative Lines */}
      <path
        d="M250 450 Q 400 500 550 450"
        stroke="#4F46E5"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M250 460 Q 400 510 550 460"
        stroke="#6366F1"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
};
