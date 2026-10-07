import * as XLSX from "xlsx";
import {
  adminListUsers, adminFetchRegistrationsJoined, adminFetchCommunityJoined,
  adminFetchCourseEnrollmentsJoined, fetchTable,
} from "./api";

function sheetFrom(rows) {
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
}

export async function exportAllDataToExcel() {
  const [users, registrations, community, workshops, projects, events, articles, courses, enrollments] = await Promise.all([
    adminListUsers(),
    adminFetchRegistrationsJoined(),
    adminFetchCommunityJoined(),
    fetchTable("workshops", { includeUnpublished: true }),
    fetchTable("projects", { includeUnpublished: true }),
    fetchTable("events", { includeUnpublished: true }),
    fetchTable("articles", { includeUnpublished: true }),
    fetchTable("courses", { includeUnpublished: true }),
    adminFetchCourseEnrollmentsJoined(),
  ]);

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, sheetFrom(users.map(u => ({
    الاسم: u.full_name, البريد: u.email, الدور: u.role, "تاريخ التسجيل": u.created_at,
  }))), "المستخدمون");

  XLSX.utils.book_append_sheet(wb, sheetFrom(registrations.map(r => ({
    "اسم المستخدم": r.user?.full_name || "", "بريد المستخدم": r.user?.email || "",
    "معرف الورشة": r.workshop_id, "تاريخ التسجيل": r.created_at,
  }))), "تسجيلات الورش");

  XLSX.utils.book_append_sheet(wb, sheetFrom(community.map(c => ({
    "الاسم": c.user?.full_name || "", "البريد": c.user?.email || "",
    "العمر": c.age, "الاهتمام": c.interest, "تاريخ الانضمام": c.created_at,
  }))), "أعضاء المجتمع");

  XLSX.utils.book_append_sheet(wb, sheetFrom(workshops.map(w => ({
    id: w.id, العنوان: w.title_ar, التصنيف: w.cat, التاريخ: w.workshop_date,
    المقاعد: w.seats, الحالة: w.status, منشور: w.is_published,
  }))), "الورش");

  XLSX.utils.book_append_sheet(wb, sheetFrom(projects.map(p => ({
    id: p.id, العنوان: p.title_ar, التقنية: p.tech, منشور: p.is_published,
  }))), "المشاريع");

  XLSX.utils.book_append_sheet(wb, sheetFrom(events.map(e => ({
    id: e.id, العنوان: e.title_ar, التاريخ: e.event_date, المكان: e.place, منشور: e.is_published,
  }))), "الفعاليات");

  XLSX.utils.book_append_sheet(wb, sheetFrom(articles.map(a => ({
    id: a.id, العنوان: a.title_ar, التصنيف: a.cat, منشور: a.is_published,
  }))), "المقالات");

  XLSX.utils.book_append_sheet(wb, sheetFrom(courses.map(c => ({
    id: c.id, العنوان: c.title_ar, التصنيف: c.cat, "عدد الدروس": (c.lessons || []).length,
    "عدد أسئلة الاختبار": (c.quiz || []).length, "درجة النجاح": c.passing_score, منشور: c.is_published,
  }))), "الدورات");

  XLSX.utils.book_append_sheet(wb, sheetFrom(enrollments.map(e => ({
    "اسم المستخدم": e.user?.full_name || "", "بريد المستخدم": e.user?.email || "",
    الدورة: e.course ? e.course.title_ar : e.course_id,
    "الدروس المكتملة": (e.completed_lessons || []).length,
    "درجة الاختبار": e.quiz_score ?? "", ناجح: e.passed ? "نعم" : "لا",
    "رمز الشهادة": e.certificate_code || "", التاريخ: e.created_at,
  }))), "تسجيلات الدورات");

  XLSX.utils.book_append_sheet(wb, sheetFrom(enrollments.filter(e => e.passed).map(e => ({
    "اسم المستخدم": e.user?.full_name || "", "بريد المستخدم": e.user?.email || "",
    الدورة: e.course ? e.course.title_ar : e.course_id,
    "درجة الاختبار": e.quiz_score ?? "", "رمز الشهادة": e.certificate_code || "",
    "تاريخ الإصدار": e.created_at,
  }))), "الشهادات");

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `node-platform-data-${stamp}.xlsx`);
}
