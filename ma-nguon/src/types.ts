export type Level = 1 | 2 | 3;

export type QType = 'mcq' | 'tf' | 'fill' | 'match' | 'order' | 'short' | 'essay';

export const QTYPE_LABEL: Record<QType, string> = {
  mcq: 'Trắc nghiệm nhiều lựa chọn',
  tf: 'Đúng / Sai',
  fill: 'Điền vào chỗ trống',
  match: 'Nối cột',
  order: 'Sắp xếp thứ tự',
  short: 'Trả lời ngắn',
  essay: 'Tự luận',
};

export interface Question {
  id: string;
  type: QType;
  prompt: string;
  passageId?: string;
  points: number;
  level: Level;
  topic: string;
  explanation?: string;
  // mcq
  options?: string[];
  answer?: number; // index của đáp án đúng (mcq); -1 = chưa có
  // tf
  statements?: string[];
  tfAnswers?: boolean[];
  // fill: chỗ trống viết là [[...]] trong prompt; mỗi ô có thể có nhiều đáp án chấp nhận (ngăn bởi |)
  blanks?: string[];
  // match
  pairs?: [string, string][];
  // order
  items?: string[]; // đúng thứ tự
  // short
  accepted?: string[];
  // essay
  guide?: string;
  // "Giải cứu kiến thức": thẻ ghi nhớ + câu tương tự (AI tạo sẵn khi giáo viên lưu đề)
  rescue?: { card: string; similar: Question[] };
}

export interface Passage {
  id: string;
  title: string;
  content: string;
  source?: string;
}

export type ExamKind = 'kiemtra' | 'khaosat' | 'ontap';

export const KIND_LABEL: Record<ExamKind, string> = {
  kiemtra: 'Đề kiểm tra',
  khaosat: 'Đề khảo sát',
  ontap: 'Đề ôn tập',
};

export interface Exam {
  id: string;
  code: string; // mã đề 6 ký tự để học sinh vào làm
  title: string;
  subject: string;
  grade: number;
  kind: ExamKind;
  duration: number; // phút, 0 = không giới hạn
  passages: Passage[];
  questions: Question[];
  author: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  open: boolean; // đang mở cho học sinh làm
  shuffle: boolean;
  showAnswers: boolean; // cho học sinh xem đáp án sau khi nộp
  classes?: string[]; // mã các lớp được giao đề
  note?: string;
  ownerUid?: string;
  ownerSchool?: string;
  public?: boolean; // chia sẻ lên kho đề chung
  copiedFrom?: string;
  deadline?: string; // hạn nộp (ISO)
  targets?: string[]; // chỉ giao cho một số học sinh: "MÃLỚP|Tên học sinh"
  group?: string; // nhãn nhóm khi giao theo nhóm năng lực
}

export interface QResult {
  qid: string;
  earned: number;
  max: number;
  status: 'right' | 'partial' | 'wrong' | 'pending'; // pending = tự luận chờ chấm
  comment?: string;
}

export interface Submission {
  id: string;
  classCode: string;
  ownerUid?: string;
  examId: string;
  examTitle: string;
  subject: string;
  className: string;
  studentName: string;
  answers: Record<string, any>;
  results: QResult[];
  score: number; // điểm đã quy về thang 10
  raw: number;
  rawMax: number;
  pending: boolean; // còn câu tự luận chưa chấm
  startedAt: string;
  submittedAt: string;
  durationSec: number;
  device?: string;
}

export interface Review {
  id: string;
  classCode: string;
  ownerUid?: string;
  className: string;
  studentName: string;
  subject: string;
  topic: string;
  summary: string; // kiến thức cần nhớ
  example?: string; // ví dụ mẫu
  tips?: string; // lời nhắc
  questions: Question[];
  createdBy: string;
  createdAt: string;
  source: 'ai' | 'auto' | 'teacher';
  best?: number; // % tốt nhất học sinh đạt được
  attempts?: number;
  mastered?: boolean;
}

export interface Resource {
  id: string;
  title: string;
  subject: string;
  kind: string; // Đề kiểm tra / Đề ôn tập / Tài liệu / Phiếu bài tập
  fileName: string;
  url?: string; // link Drive (bản trực tuyến)
  dataUrl?: string; // bản cục bộ
  size: number;
  author: string;
  createdAt: string;
  note?: string;
  ownerUid?: string;
  public?: boolean;
}

// Lớp học của một giáo viên – id = mã lớp (học sinh nhập mã này để vào lớp)
export interface ClassRoom {
  id: string;
  name: string; // VD 5A3
  ownerUid: string;
  ownerName: string;
  school: string;
  province: string;
  students: string[];
  createdAt: string;
  parentKeys?: Record<string, string>; // tên học sinh -> mã phụ huynh
  notice?: string; // thông báo lớp
  videos?: Record<string, string>; // chủ đề -> link video
  schoolCode?: string;
}

// Hoạt động luyện tập của học sinh (ôn tập, nhiệm vụ mỗi ngày, giải cứu kiến thức)
export interface Activity {
  id: string;
  classCode: string;
  studentName: string;
  kind: 'practice' | 'daily' | 'review' | 'rescue';
  subject: string;
  topic: string;
  correct: number;
  total: number;
  percent: number;
  durationSec: number;
  at: string;
}

export interface School {
  id: string; // mã trường
  name: string;
  province: string;
  createdBy: string;
  members: string[];
  memberNames: Record<string, string>;
  classes: string[];
}

export interface Teacher {
  uid: string;
  name: string;
  email: string;
  school: string;
  province: string;
  photo?: string;
  schoolCode?: string;
}

// Thông tin lưu trên máy (học sinh nhớ lớp + tên)
export interface Profile {
  role: 'teacher' | 'student';
  classCode: string;
  className: string;
  teacherName: string;
  studentName: string;
}
