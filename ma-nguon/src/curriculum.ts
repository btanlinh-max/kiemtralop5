// Chương trình lớp 5 – bộ sách Kết nối tri thức với cuộc sống (GDPT 2018)
export interface SubjectInfo {
  name: string;
  icon: string;
  color: string; // màu chủ đạo (tailwind)
  periodic: boolean; // có bài kiểm tra định kỳ theo TT27
  topics: string[];
}

export const SUBJECTS: SubjectInfo[] = [
  {
    name: 'Toán', icon: '🔢', color: 'sky', periodic: true,
    topics: [
      'Ôn tập số tự nhiên',
      'Ôn tập phân số, hỗn số',
      'Phân số thập phân',
      'Số thập phân (đọc, viết, cấu tạo)',
      'So sánh, làm tròn số thập phân',
      'Viết số đo đại lượng dưới dạng số thập phân',
      'Đơn vị đo diện tích (km², ha)',
      'Cộng, trừ số thập phân',
      'Nhân, chia số thập phân',
      'Tính giá trị biểu thức, tính thuận tiện',
      'Góc và đo góc',
      'Hình tam giác, hình thang',
      'Hình tròn, đường tròn',
      'Tỉ số và tỉ số phần trăm',
      'Tỉ lệ bản đồ',
      'Bài toán tìm hai số (tổng/hiệu – tỉ)',
      'Thể tích, đơn vị đo thể tích',
      'Diện tích, thể tích hình hộp chữ nhật, hình lập phương',
      'Số đo thời gian',
      'Vận tốc, quãng đường, thời gian (chuyển động đều)',
      'Thống kê và xác suất',
      'Giải toán có lời văn',
    ],
  },
  {
    name: 'Tiếng Việt', icon: '📖', color: 'rose', periodic: true,
    topics: [
      'Đọc hiểu – nội dung, chi tiết',
      'Đọc hiểu – ý nghĩa, bài học',
      'Từ đồng nghĩa',
      'Từ đa nghĩa',
      'Đại từ',
      'Kết từ',
      'Câu ghép, cách nối các vế câu ghép',
      'Trạng ngữ, chủ ngữ, vị ngữ',
      'Dấu gạch ngang, dấu câu',
      'Biện pháp điệp từ, điệp ngữ',
      'Từ ngữ theo chủ điểm',
      'Viết – kể chuyện sáng tạo',
      'Viết – tả phong cảnh',
      'Viết – tả người',
      'Viết – đoạn văn nêu ý kiến, tình cảm',
      'Viết – báo cáo, chương trình hoạt động',
    ],
  },
  {
    name: 'Tiếng Anh', icon: '🔤', color: 'violet', periodic: true,
    topics: ['Vocabulary', 'Grammar', 'Reading', 'Writing', 'Listening', 'Phonics / Pronunciation'],
  },
  {
    name: 'Khoa học', icon: '🔬', color: 'emerald', periodic: true,
    topics: [
      'Chất (đất, hỗn hợp, dung dịch, sự biến đổi của chất)',
      'Năng lượng (điện, mạch điện, năng lượng chất đốt, mặt trời, gió, nước)',
      'Thực vật và động vật (sinh sản)',
      'Vi khuẩn',
      'Con người và sức khỏe (tuổi dậy thì, phòng tránh xâm hại)',
      'Sinh vật và môi trường',
    ],
  },
  {
    name: 'Lịch sử và Địa lí', icon: '🗺️', color: 'amber', periodic: true,
    topics: [
      'Đất nước và con người Việt Nam (vị trí, biển đảo, dân cư)',
      'Những quốc gia đầu tiên trên lãnh thổ Việt Nam',
      'Xây dựng và bảo vệ đất nước (các triều đại, kháng chiến)',
      'Các nước láng giềng',
      'Tìm hiểu thế giới (châu lục, đại dương, văn minh)',
      'Chung tay xây dựng thế giới',
    ],
  },
  {
    name: 'Tin học', icon: '💻', color: 'cyan', periodic: true,
    topics: ['Máy tính và em', 'Mạng máy tính và Internet', 'Tổ chức lưu trữ, tìm kiếm thông tin', 'Đạo đức, pháp luật và văn hóa số', 'Ứng dụng tin học', 'Giải quyết vấn đề với sự trợ giúp của máy tính (Scratch)'],
  },
  {
    name: 'Công nghệ', icon: '⚙️', color: 'orange', periodic: true,
    topics: ['Công nghệ và đời sống', 'Sáng chế, thiết kế sản phẩm', 'Sử dụng điện thoại', 'Sử dụng tủ lạnh', 'Lắp ráp mô hình điện mặt trời / mô hình máy phát điện gió', 'Lắp ráp mô hình xe điện chạy bằng pin'],
  },
  {
    name: 'Đạo đức', icon: '💗', color: 'pink', periodic: false,
    topics: ['Biết ơn người có công với quê hương, đất nước', 'Tôn trọng sự khác biệt', 'Vượt qua khó khăn', 'Bảo vệ cái đúng, cái tốt', 'Bảo vệ môi trường sống', 'Lập kế hoạch cá nhân', 'Phòng tránh xâm hại', 'Sử dụng tiền hợp lí'],
  },
  {
    name: 'Hoạt động trải nghiệm', icon: '🌱', color: 'lime', periodic: false,
    topics: ['Hoạt động hướng đến bản thân', 'Hoạt động hướng đến quan hệ xã hội', 'Hoạt động hướng đến tự nhiên', 'Hoạt động hướng nghiệp'],
  },
  {
    name: 'Âm nhạc', icon: '🎵', color: 'fuchsia', periodic: false,
    topics: ['Hát', 'Nghe nhạc', 'Đọc nhạc', 'Nhạc cụ', 'Thường thức âm nhạc'],
  },
  {
    name: 'Mĩ thuật', icon: '🎨', color: 'purple', periodic: false,
    topics: ['Mĩ thuật tạo hình', 'Mĩ thuật ứng dụng', 'Thường thức mĩ thuật'],
  },
  {
    name: 'Giáo dục thể chất', icon: '⚽', color: 'teal', periodic: false,
    topics: ['Đội hình đội ngũ', 'Bài tập thể dục', 'Tư thế và kĩ năng vận động cơ bản', 'Thể thao tự chọn'],
  },
];

export const SUBJECT_NAMES = SUBJECTS.map((s) => s.name);

export function subjectInfo(name: string): SubjectInfo {
  return SUBJECTS.find((s) => s.name === name) || { name, icon: '📘', color: 'slate', periodic: false, topics: [] };
}

export const LEVEL_LABEL: Record<number, string> = {
  1: 'Mức 1 – Nhận biết',
  2: 'Mức 2 – Kết nối',
  3: 'Mức 3 – Vận dụng',
};

export const LEVEL_SHORT: Record<number, string> = { 1: 'M1', 2: 'M2', 3: 'M3' };

// Lớp màu cố định cho tailwind (tránh class động bị lọc)
export const COLOR_CHIP: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  pink: 'bg-pink-100 text-pink-800 border-pink-200',
  lime: 'bg-lime-100 text-lime-800 border-lime-200',
  fuchsia: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
};
