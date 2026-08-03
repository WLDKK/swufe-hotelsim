import { TeacherSemestersPanel } from "@/components/teacher/teacher-semesters-panel";

export default function TeacherSemestersPage() {
  // Keep the page file thin so route ownership stays obvious while the actual
  // API-driven teacher UI lives in a reusable client component.
  return <TeacherSemestersPanel />;
}
