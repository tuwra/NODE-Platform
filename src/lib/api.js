import { supabase } from "./supabase";

/* ---------------------------------------------------------------- */
/* Auth                                                              */
/* ---------------------------------------------------------------- */

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName || "" } },
  });
  if (error) throw error;
  return data;
}

export async function verifySignupOtp({ email, token }) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  if (error) throw error;
  return data;
}

export async function resendSignupOtp({ email }) {
  const { error } = await supabase.auth.resend({ type: "signup", email });
  if (error) throw error;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getProfile(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------------------------------------------------------------- */
/* Public content (read)                                             */
/* ---------------------------------------------------------------- */

const CONTENT_TABLES = {
  workshops: "workshops",
  projects: "projects",
  events: "events",
  articles: "articles",
  labs: "labs",
  team: "team_members",
  sections: "sections",
  courses: "courses",
  lab_experiments: "lab_experiments",
};

export async function fetchTable(key, { includeUnpublished = false } = {}) {
  const table = CONTENT_TABLES[key];
  // order by created_at then id: rows inserted in the same statement share
  // one timestamp, so id breaks ties deterministically (otherwise editing a
  // row can silently reshuffle its position on the next fetch).
  let q = supabase.from(table).select("*").order("created_at", { ascending: true }).order("id", { ascending: true });
  const { data, error } = await q;
  if (error) throw error;
  return includeUnpublished ? data : data.filter((r) => r.is_published !== false);
}

export async function fetchWorkshopBookedCounts() {
  const { data, error } = await supabase.rpc("workshop_booked_counts");
  if (error) throw error;
  const map = {};
  for (const row of data) map[row.workshop_id] = row.booked;
  return map;
}

export async function fetchSiteSettings() {
  try {
    const { data, error } = await supabase.from("site_settings").select("*");
    if (error) throw error;
    const map = {};
    for (const row of data) map[row.id] = row.value;
    return map;
  } catch (e) {
    // Table not created yet (supabase-patch-3-site-settings.sql not run) —
    // fail soft so the public site still renders with its built-in text.
    return {};
  }
}

export async function updateSiteSetting(id, value) {
  const { data, error } = await supabase.from("site_settings").update({ value }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/* ---------------------------------------------------------------- */
/* Contact form                                                      */
/* ---------------------------------------------------------------- */

export async function submitContactMessage({ name, email, subject, message }) {
  const { error } = await supabase.from("contact_messages").insert({ name, email, subject, message });
  if (error) throw error;
}

export async function adminFetchContactMessages() {
  const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function adminMarkContactMessageRead(id, status = "read") {
  const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function adminDeleteContactMessage(id) {
  const { error } = await supabase.from("contact_messages").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAllContent() {
  const [workshops, projects, events, articles, labs, team, sections, courses, booked, settings, labExperiments] = await Promise.all([
    fetchTable("workshops"),
    fetchTable("projects"),
    fetchTable("events"),
    fetchTable("articles"),
    fetchTable("labs"),
    fetchTable("team"),
    fetchTable("sections"),
    fetchTable("courses"),
    fetchWorkshopBookedCounts(),
    fetchSiteSettings(),
    fetchTable("lab_experiments"),
  ]);
  return { workshops, projects, events, articles, labs, team, sections, courses, booked, settings, labExperiments };
}

/* ---------------------------------------------------------------- */
/* Workshop registration & community join (require a real account —
   this is the "guest limit": anyone can browse, but acting needs login) */
/* ---------------------------------------------------------------- */

export async function registerForWorkshop(workshopId, userId) {
  const { error } = await supabase.from("registrations").insert({ workshop_id: workshopId, user_id: userId });
  if (error) throw error;
}

export async function getMyRegistrations(userId) {
  const { data, error } = await supabase.from("registrations").select("workshop_id").eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((r) => r.workshop_id));
}

export async function joinCommunity({ userId, age, interest }) {
  const { error } = await supabase
    .from("community_members")
    .upsert({ user_id: userId, age, interest }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function getMyCommunityMembership(userId) {
  const { data, error } = await supabase.from("community_members").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------------------------------------------------------------- */
/* Courses — video lessons + quiz + certificate on passing            */
/* ---------------------------------------------------------------- */

export async function getMyCourseEnrollment(courseId, userId) {
  const { data, error } = await supabase
    .from("course_enrollments").select("*")
    .eq("course_id", courseId).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyCourseEnrollments(userId) {
  const { data, error } = await supabase.from("course_enrollments").select("*").eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function enrollInCourse(courseId, userId) {
  const { error } = await supabase
    .from("course_enrollments")
    .upsert({ user_id: userId, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function updateLessonProgress(courseId, userId, completedLessons) {
  const { error } = await supabase
    .from("course_enrollments")
    .upsert({ user_id: userId, course_id: courseId, completed_lessons: completedLessons }, { onConflict: "user_id,course_id" });
  if (error) throw error;
}

// Grading + certificate issuance happen on the server (see complete_course
// in supabase-patch-2.sql) so pass/fail and the certificate code can't be
// forged from the browser.
export async function completeCourse(courseId, score) {
  const { data, error } = await supabase.rpc("complete_course", { p_course_id: courseId, p_score: score });
  if (error) throw error;
  return data;
}

// Public — no login needed, used by the certificate/verification page.
export async function verifyCertificate(code) {
  const { data, error } = await supabase.rpc("verify_certificate", { p_code: code });
  if (error) throw error;
  return data?.[0] || null;
}

/* ---------------------------------------------------------------- */
/* Admin — users                                                     */
/* ---------------------------------------------------------------- */

export async function adminListUsers() {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return data;
}

export async function adminSetUserRole(targetId, role) {
  const { error } = await supabase.rpc("set_user_role", { target_id: targetId, new_role: role });
  if (error) throw error;
}

/* Admin — joined views (client-side join since registrations/community
   reference auth.users, not profiles, so PostgREST can't embed them) */

export async function adminFetchRegistrationsJoined() {
  const [{ data: regs, error: e1 }, users] = await Promise.all([
    supabase.from("registrations").select("workshop_id,user_id,created_at").order("created_at", { ascending: false }),
    adminListUsers(),
  ]);
  if (e1) throw e1;
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return regs.map((r) => ({ ...r, user: byId[r.user_id] }));
}

export async function adminFetchCommunityJoined() {
  const [{ data: rows, error: e1 }, users] = await Promise.all([
    supabase.from("community_members").select("*").order("created_at", { ascending: false }),
    adminListUsers(),
  ]);
  if (e1) throw e1;
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, user: byId[r.user_id] }));
}

export async function adminFetchCourseEnrollmentsJoined() {
  const [{ data: rows, error: e1 }, users, courses] = await Promise.all([
    supabase.from("course_enrollments").select("*").order("created_at", { ascending: false }),
    adminListUsers(),
    fetchTable("courses", { includeUnpublished: true }),
  ]);
  if (e1) throw e1;
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]));
  return rows.map((r) => ({ ...r, user: byId[r.user_id], course: courseById[r.course_id] }));
}

/* ---------------------------------------------------------------- */
/* Admin — generic content CRUD (works for any table in CONTENT_TABLES,
   incl. "sections" — this is the no-code "add a section" feature)     */
/* ---------------------------------------------------------------- */

export async function adminCreateRow(key, row) {
  const table = CONTENT_TABLES[key];
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function adminUpdateRow(key, id, patch) {
  const table = CONTENT_TABLES[key];
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function adminDeleteRow(key, id) {
  const table = CONTENT_TABLES[key];
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}
