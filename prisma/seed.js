const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu khởi tạo dữ liệu mẫu cho hệ thống Chấm công & Phê duyệt...');

  // 1. Khởi tạo Chi nhánh (Branches)
  const branchHN = await prisma.branch.upsert({
    where: { code: 'HN_HQ' },
    update: {},
    create: {
      name: 'Hà Nội - Trụ sở chính',
      code: 'HN_HQ',
      address: 'Số 1 Đinh Lễ, Tràng Tiền, Hoàn Kiếm, Hà Nội',
      latitude: 21.028511,
      longitude: 105.854167,
      radiusMeters: 500.0,
      wifiBssids: 'PEACE_OFFICE_5G,PEACE_GUEST',
      isActive: true,
    },
  });

  const branchHCM = await prisma.branch.upsert({
    where: { code: 'HCM_BR' },
    update: {},
    create: {
      name: 'Hồ Chí Minh - Chi nhánh',
      code: 'HCM_BR',
      address: 'Tòa nhà Landmark 81, Vinhomes Central Park, Bình Thạnh, TP.HCM',
      latitude: 10.795166,
      longitude: 106.721833,
      radiusMeters: 500.0,
      wifiBssids: 'PEACE_HCM_5G',
      isActive: true,
    },
  });

  console.log('✅ Đã tạo 2 chi nhánh.');

  // 2. Khởi tạo Phòng ban (Departments)
  const deptBGD = await prisma.department.upsert({
    where: { code: 'BGD' },
    update: {},
    create: {
      name: 'Ban Giám Đốc',
      code: 'BGD',
    },
  });

  const deptHR = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {},
    create: {
      name: 'Phòng Nhân Sự',
      code: 'HR',
    },
  });

  const deptTech = await prisma.department.upsert({
    where: { code: 'TECH' },
    update: {},
    create: {
      name: 'Phòng Kỹ Thuật (Tech & Dev)',
      code: 'TECH',
    },
  });

  const deptSales = await prisma.department.upsert({
    where: { code: 'SALES' },
    update: {},
    create: {
      name: 'Phòng Kinh Doanh & Marketing',
      code: 'SALES',
    },
  });

  console.log('✅ Đã tạo 4 phòng ban.');

  // 3. Khởi tạo Khung giờ & Ca làm việc tiêu chuẩn (MỤC 1)
  // Thứ 2 đến Thứ 7:
  // Ca 1 (Sáng): 08h00 – 12h00 (4 tiếng = 1 công, check-in sớm từ 07h45)
  const shift1Sang = await prisma.shift.upsert({
    where: { code: 'CA_1_SANG' },
    update: {},
    create: {
      name: 'Ca 1 - Sáng (08h00 - 12h00)',
      code: 'CA_1_SANG',
      startTime: '08:00',
      endTime: '12:00',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      isFlexible: false,
      minWorkHours: 4.0,
      isActive: true,
    },
  });

  // Ca 2 (Chiều): 13h30 – 17h30 (4 tiếng = 1 công)
  const shift2Chieu = await prisma.shift.upsert({
    where: { code: 'CA_2_CHIEU' },
    update: {},
    create: {
      name: 'Ca 2 - Chiều (13h30 - 17h30)',
      code: 'CA_2_CHIEU',
      startTime: '13:30',
      endTime: '17:30',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      isFlexible: false,
      minWorkHours: 4.0,
      isActive: true,
    },
  });

  // Ca 3 (Tối): 15h30 – 19h30 (4 tiếng = 1 công)
  const shift3Toi = await prisma.shift.upsert({
    where: { code: 'CA_3_TOI' },
    update: {},
    create: {
      name: 'Ca 3 - Tối (15h30 - 19h30)',
      code: 'CA_3_TOI',
      startTime: '15:30',
      endTime: '19:30',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      isFlexible: false,
      minWorkHours: 4.0,
      isActive: true,
    },
  });

  // Ca Cả Ngày (Sáng - Chiều - Tối: 08h00 - 19h30 = 3 công)
  const shiftAllDay = await prisma.shift.upsert({
    where: { code: 'CA_ALL_DAY' },
    update: {},
    create: {
      name: 'Ca Cả Ngày (08h00 - 19h30 = 3 công)',
      code: 'CA_ALL_DAY',
      startTime: '08:00',
      endTime: '19:30',
      breakStartTime: '12:00',
      breakEndTime: '13:30',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 3.0,
      isFlexible: false,
      minWorkHours: 10.0,
      isActive: true,
    },
  });

  // Chủ Nhật:
  // Ca 1 (Sáng): 08h00 – 12h00
  const shiftCNSang = await prisma.shift.upsert({
    where: { code: 'CA_CN_SANG' },
    update: {},
    create: {
      name: 'Chủ Nhật - Ca 1 Sáng (08h00 - 12h00)',
      code: 'CA_CN_SANG',
      startTime: '08:00',
      endTime: '12:00',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      isFlexible: false,
      minWorkHours: 4.0,
      isActive: true,
    },
  });

  // Ca 2 (Chiều): 13h30 – 18h00
  const shiftCNChieu = await prisma.shift.upsert({
    where: { code: 'CA_CN_CHIEU' },
    update: {},
    create: {
      name: 'Chủ Nhật - Ca 2 Chiều (13h30 - 18h00)',
      code: 'CA_CN_CHIEU',
      startTime: '13:30',
      endTime: '18:00',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      isFlexible: false,
      minWorkHours: 4.5,
      isActive: true,
    },
  });

  // Ca Hành Chính tiêu chuẩn (08h00 - 17h30)
  const shiftHC = await prisma.shift.upsert({
    where: { code: 'CA_HC' },
    update: {
      name: 'Ca Hành Chính (08h00 - 17h30)',
      startTime: '08:00',
      endTime: '17:30',
      breakStartTime: '12:00',
      breakEndTime: '13:30',
      minWorkHours: 8.0,
    },
    create: {
      name: 'Ca Hành Chính (08h00 - 17h30)',
      code: 'CA_HC',
      startTime: '08:00',
      endTime: '17:30',
      breakStartTime: '12:00',
      breakEndTime: '13:30',
      gracePeriodLate: 15,
      gracePeriodEarly: 15,
      workUnits: 1.0,
      isFlexible: false,
      minWorkHours: 8.0,
      isActive: true,
    },
  });

  console.log('✅ Đã tạo đầy đủ các ca làm việc tiêu chuẩn T2-T7 và Chủ Nhật.');

  // 4. Khởi tạo Người dùng (Users & Roles)
  const defaultPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  // Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@peace.vn' },
    update: {},
    create: {
      employeeCode: 'NV001',
      name: 'Nguyễn Văn Admin',
      email: 'admin@peace.vn',
      passwordHash: defaultPassword,
      phone: '0901234567',
      role: 'SUPER_ADMIN',
      position: 'Tổng Giám Đốc',
      branchId: branchHN.id,
      departmentId: deptBGD.id,
      annualLeaveQuota: 14.0,
      annualLeaveUsed: 0.0,
      isActive: true,
    },
  });

  // HR Admin
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@peace.vn' },
    update: {},
    create: {
      employeeCode: 'NV002',
      name: 'Trần Thị Thu Hà (HR)',
      email: 'hr@peace.vn',
      passwordHash: defaultPassword,
      phone: '0912345678',
      role: 'HR_ADMIN',
      position: 'Trưởng Phòng Nhân Sự',
      branchId: branchHN.id,
      departmentId: deptHR.id,
      managerId: admin.id,
      annualLeaveQuota: 12.0,
      annualLeaveUsed: 1.0,
      isActive: true,
    },
  });

  // Manager (Tech)
  const managerTech = await prisma.user.upsert({
    where: { email: 'manager@peace.vn' },
    update: {},
    create: {
      employeeCode: 'NV003',
      name: 'Lê Hoàng Manager',
      email: 'manager@peace.vn',
      passwordHash: defaultPassword,
      phone: '0923456789',
      role: 'MANAGER',
      position: 'Trưởng Phòng Kỹ Thuật',
      branchId: branchHN.id,
      departmentId: deptTech.id,
      managerId: admin.id,
      annualLeaveQuota: 12.0,
      annualLeaveUsed: 2.0,
      isActive: true,
    },
  });

  // Employee 1 (Nguyễn Văn Lâm - Tech)
  const employeeLam = await prisma.user.upsert({
    where: { email: 'lam@peace.vn' },
    update: {},
    create: {
      employeeCode: 'NV004',
      name: 'Nguyễn Văn Lâm',
      email: 'lam@peace.vn',
      passwordHash: userPassword,
      phone: '0934567890',
      role: 'EMPLOYEE',
      position: 'Kỹ Sư Lập Trình Cao Cấp',
      branchId: branchHN.id,
      departmentId: deptTech.id,
      managerId: managerTech.id,
      annualLeaveQuota: 12.0,
      annualLeaveUsed: 1.5,
      isActive: true,
    },
  });

  // Employee 2 (Phạm Quỳnh Hoa - Sales)
  const employeeHoa = await prisma.user.upsert({
    where: { email: 'hoa@peace.vn' },
    update: {},
    create: {
      employeeCode: 'NV005',
      name: 'Phạm Quỳnh Hoa',
      email: 'hoa@peace.vn',
      passwordHash: userPassword,
      phone: '0945678901',
      role: 'EMPLOYEE',
      position: 'Chuyên Viên Kinh Doanh',
      branchId: branchHCM.id,
      departmentId: deptSales.id,
      managerId: admin.id,
      annualLeaveQuota: 12.0,
      annualLeaveUsed: 0.0,
      isActive: true,
    },
  });

  console.log('✅ Đã tạo 5 tài khoản mẫu.');

  // 5. Khởi tạo Danh mục 8 Mẫu Đơn & Phiếu Xác Nhận Chuẩn Hóa (MỤC 5)

  // 5.1 Đơn Nghỉ Phép Năm (Trừ quỹ phép)
  await prisma.approvalTemplate.upsert({
    where: { code: 'LEAVE_ANNUAL' },
    update: {},
    create: {
      name: 'Đơn Xin Nghỉ Phép Năm',
      code: 'LEAVE_ANNUAL',
      icon: 'CalendarOff',
      description: 'Nghỉ phép năm hưởng nguyên lương, tự động trừ vào quỹ phép năm.',
      schemaFields: JSON.stringify([
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày nghỉ (công)', type: 'number', required: true, default: 1.0 },
        { name: 'reason', label: 'Lý do xin nghỉ', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự trừ quỹ phép' },
      ]),
      isActive: true,
    },
  });

  // 5.2 Đơn Nghỉ Không Lương
  await prisma.approvalTemplate.upsert({
    where: { code: 'LEAVE_UNPAID' },
    update: {},
    create: {
      name: 'Đơn Xin Nghỉ Không Lương',
      code: 'LEAVE_UNPAID',
      icon: 'CalendarOff',
      description: 'Nghỉ việc riêng không hưởng lương (0 công, không trừ quỹ phép).',
      schemaFields: JSON.stringify([
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày nghỉ', type: 'number', required: true, default: 1.0 },
        { name: 'reason', label: 'Lý do xin nghỉ', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự xác nhận' },
      ]),
      isActive: true,
    },
  });

  // 5.3 Đơn Nghỉ Ốm / BHXH
  await prisma.approvalTemplate.upsert({
    where: { code: 'LEAVE_SICK' },
    update: {},
    create: {
      name: 'Đơn Xin Nghỉ Ốm / BHXH',
      code: 'LEAVE_SICK',
      icon: 'CalendarOff',
      description: 'Nghỉ ốm đau, khám thai, thai sản hưởng chế độ BHXH (có giấy y tế).',
      schemaFields: JSON.stringify([
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày nghỉ', type: 'number', required: true, default: 1.0 },
        { name: 'medicalHospital', label: 'Cơ sở khám chữa bệnh', type: 'text', required: true },
        { name: 'reason', label: 'Tình trạng sức khỏe / Chẩn đoán', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự tiếp nhận hồ sơ BHXH' },
      ]),
      isActive: true,
    },
  });

  // 5.4 Đơn Nghỉ Việc Riêng Hưởng Nguyên Lương
  await prisma.approvalTemplate.upsert({
    where: { code: 'LEAVE_SPECIAL' },
    update: {},
    create: {
      name: 'Đơn Nghỉ Việc Riêng Hưởng Nguyên Lương',
      code: 'LEAVE_SPECIAL',
      icon: 'CalendarOff',
      description: 'Nghỉ việc riêng hưởng nguyên lương theo luật (Kết hôn, con kết hôn, tứ thân phụ mẫu mất...).',
      schemaFields: JSON.stringify([
        { name: 'leaveCategory', label: 'Loại việc riêng', type: 'select', options: ['Bản thân kết hôn (3 ngày)', 'Con kết hôn (1 ngày)', 'Tứ thân phụ mẫu/vợ/chồng/con mất (3 ngày)'], required: true },
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày nghỉ', type: 'number', required: true, default: 1.0 },
        { name: 'reason', label: 'Ghi chú chi tiết', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự xác nhận đủ công' },
      ]),
      isActive: true,
    },
  });

  // 5.5 Đơn Nghỉ Nửa Ca (0.5 công)
  await prisma.approvalTemplate.upsert({
    where: { code: 'LEAVE_HALF_SHIFT' },
    update: {},
    create: {
      name: 'Đơn Xin Nghỉ Nửa Ca (0.5 Công)',
      code: 'LEAVE_HALF_SHIFT',
      icon: 'CalendarOff',
      description: 'Xin phép nghỉ nửa ca (0.5 công phép), hệ thống không phạt đi trễ ngày đó.',
      schemaFields: JSON.stringify([
        { name: 'workDate', label: 'Ngày xin nghỉ nửa ca', type: 'date', required: true },
        { name: 'shiftType', label: 'Nửa ca xin nghỉ', type: 'select', options: ['Nửa ca sáng (08h00 - 10h00)', 'Nửa ca chiều (13h30 - 15h30)', 'Nửa ca tối (17h30 - 19h30)'], required: true },
        { name: 'duration', label: 'Số công nghỉ', type: 'number', required: true, default: 0.5 },
        { name: 'reason', label: 'Lý do cụ thể', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự ghi nhận 0.5 công' },
      ]),
      isActive: true,
    },
  });

  // 5.6 Phiếu Xác Nhận Đi Trễ / Về Sớm
  await prisma.approvalTemplate.upsert({
    where: { code: 'LATE_EARLY_CONFIRM' },
    update: {},
    create: {
      name: 'Phiếu Xác Nhận Đi Trễ / Về Sớm',
      code: 'LATE_EARLY_CONFIRM',
      icon: 'Clock',
      description: 'Phiếu xác nhận đi trễ hoặc về sớm có lý do chính đáng, xóa phạt trễ > 30 phút và giữ nguyên đủ công.',
      schemaFields: JSON.stringify([
        { name: 'workDate', label: 'Ngày áp dụng', type: 'date', required: true },
        { name: 'type', label: 'Loại đề xuất', type: 'select', options: ['Xác nhận đi trễ', 'Xác nhận về sớm', 'Cả đi trễ và về sớm'], required: true },
        { name: 'actualMinutes', label: 'Số phút đi trễ / về sớm', type: 'number', required: true },
        { name: 'reason', label: 'Lý do xác nhận (kẹt xe, tiếp khách, chỉ định Bác sĩ...)', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DIRECT_MANAGER',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý chi nhánh duyệt xóa phạt' },
      ]),
      isActive: true,
    },
  });

  // 5.7 Phiếu Xác Nhận Quên Chấm Công
  await prisma.approvalTemplate.upsert({
    where: { code: 'FORGOT_CHECKIN_CONFIRM' },
    update: {},
    create: {
      name: 'Phiếu Xác Nhận Quên Chấm Công',
      code: 'FORGOT_CHECKIN_CONFIRM',
      icon: 'ClockAlert',
      description: 'Phiếu xác nhận quên bấm vân tay/chấm công trong ngày, khôi phục đủ công cho ca đó.',
      schemaFields: JSON.stringify([
        { name: 'workDate', label: 'Ngày quên chấm công', type: 'date', required: true },
        { name: 'shiftType', label: 'Ca làm việc bị quên', type: 'select', options: ['Ca 1 (Sáng: 08h00 - 12h00)', 'Ca 2 (Chiều: 13h30 - 17h30)', 'Ca 3 (Tối: 15h30 - 19h30)', 'Ca Cả Ngày (08h00 - 19h30)'], required: true },
        { name: 'checkInTime', label: 'Giờ vào thực tế', type: 'time', required: true },
        { name: 'checkOutTime', label: 'Giờ ra thực tế', type: 'time', required: true },
        { name: 'reason', label: 'Lý do quên bấm vân tay', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý chi nhánh xác nhận' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự bù công' },
      ]),
      isActive: true,
    },
  });

  // 5.8 Phiếu Xác Nhận Tăng Ca (OT x2)
  await prisma.approvalTemplate.upsert({
    where: { code: 'OVERTIME_X2_CONFIRM' },
    update: {},
    create: {
      name: 'Phiếu Xác Nhận Tăng Ca (OT x2)',
      code: 'OVERTIME_X2_CONFIRM',
      icon: 'Flame',
      description: 'Phiếu xác nhận làm thêm giờ ngoài ca tiêu chuẩn (từ 15 phút trở lên, áp dụng hệ số nhân đôi x2).',
      schemaFields: JSON.stringify([
        { name: 'workDate', label: 'Ngày tăng ca', type: 'date', required: true },
        { name: 'otStartTime', label: 'Giờ bắt đầu OT', type: 'time', required: true },
        { name: 'otEndTime', label: 'Giờ kết thúc OT', type: 'time', required: true },
        { name: 'actualMinutes', label: 'Tổng số phút OT thực tế (tối thiểu 15p)', type: 'number', required: true },
        { name: 'doctorOrManagerName', label: 'Bác sĩ / Quản lý yêu cầu tăng ca', type: 'text', required: true },
        { name: 'taskDescription', label: 'Nội dung ca phẫu thuật / điều trị / công việc OT', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý chi nhánh xác nhận' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự ghi nhận OT x2' },
      ]),
      isActive: true,
    },
  });

  // Giữ lại các template cơ bản để tương thích ngược
  await prisma.approvalTemplate.upsert({
    where: { code: 'LEAVE' },
    update: {},
    create: {
      name: 'Đơn Xin Nghỉ Phép (Tổng Hợp)',
      code: 'LEAVE',
      icon: 'CalendarOff',
      description: 'Nghỉ phép năm, nghỉ ốm, nghỉ chế độ hoặc nghỉ không lương.',
      schemaFields: JSON.stringify([
        { name: 'leaveType', label: 'Loại nghỉ phép', type: 'select', options: ['Nghỉ phép năm (có lương)', 'Nghỉ ốm / thai sản (hưởng BHXH)', 'Nghỉ việc riêng (có lương)', 'Nghỉ không lương'], required: true },
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày nghỉ', type: 'number', required: true, default: 1.0 },
        { name: 'reason', label: 'Lý do xin nghỉ', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự xác nhận trừ phép' },
      ]),
      isActive: true,
    },
  });

  await prisma.approvalTemplate.upsert({
    where: { code: 'ADJUSTMENT' },
    update: {},
    create: {
      name: 'Đơn Chấm Công Bổ Sung / Giải Trình',
      code: 'ADJUSTMENT',
      icon: 'ClockAlert',
      description: 'Giải trình khi quên check-in/out, thiết bị lỗi GPS hoặc đi công tác bên ngoài.',
      schemaFields: JSON.stringify([
        { name: 'workDate', label: 'Ngày cần bổ sung công', type: 'date', required: true },
        { name: 'checkInTime', label: 'Giờ Check-in thực tế', type: 'time', required: true },
        { name: 'checkOutTime', label: 'Giờ Check-out thực tế', type: 'time', required: true },
        { name: 'reasonType', label: 'Nguyên nhân', type: 'select', options: ['Quên chấm công', 'Lỗi GPS / Camera thiết bị', 'Đi công tác / Gặp khách hàng', 'Mất mạng Internet'], required: true },
        { name: 'reason', label: 'Mô tả chi tiết giải trình', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Nhân sự chốt sửa bảng công' },
      ]),
      isActive: true,
    },
  });

  await prisma.approvalTemplate.upsert({
    where: { code: 'LATE_EARLY' },
    update: {},
    create: {
      name: 'Đơn Xin Đi Muộn / Về Sớm',
      code: 'LATE_EARLY',
      icon: 'Clock',
      description: 'Xin phép đi muộn hoặc về sớm vì việc đột xuất, khám bệnh, giải quyết việc cá nhân.',
      schemaFields: JSON.stringify([
        { name: 'type', label: 'Loại đơn', type: 'select', options: ['Xin đi muộn', 'Xin về sớm', 'Cả đi muộn và về sớm'], required: true },
        { name: 'workDate', label: 'Ngày áp dụng', type: 'date', required: true },
        { name: 'expectedTime', label: 'Thời gian dự kiến có mặt / rời đi', type: 'time', required: true },
        { name: 'reason', label: 'Lý do cụ thể', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DIRECT_MANAGER',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
      ]),
      isActive: true,
    },
  });

  await prisma.approvalTemplate.upsert({
    where: { code: 'OVERTIME' },
    update: {},
    create: {
      name: 'Đơn Làm Thêm Giờ (OT)',
      code: 'OVERTIME',
      icon: 'Flame',
      description: 'Đăng ký làm thêm giờ ngoài ca làm việc hoặc làm việc vào ngày cuối tuần.',
      schemaFields: JSON.stringify([
        { name: 'workDate', label: 'Ngày làm thêm OT', type: 'date', required: true },
        { name: 'otStartTime', label: 'Bắt đầu từ', type: 'time', required: true },
        { name: 'otEndTime', label: 'Đến khi', type: 'time', required: true },
        { name: 'estimatedHours', label: 'Tổng số giờ OT dự kiến', type: 'number', required: true },
        { name: 'taskDescription', label: 'Nội dung công việc cần xử lý OT', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp xác nhận' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Nhân sự ghi nhận tính công OT' },
      ]),
      isActive: true,
    },
  });

  await prisma.approvalTemplate.upsert({
    where: { code: 'PAYMENT' },
    update: {},
    create: {
      name: 'Đơn Đề Xuất Tạm Ứng / Thanh Toán',
      code: 'PAYMENT',
      icon: 'CreditCard',
      description: 'Đề xuất tạm ứng chi phí công tác, mua sắm vật tư hoặc thanh toán hóa đơn.',
      schemaFields: JSON.stringify([
        { name: 'requestType', label: 'Hình thức', type: 'select', options: ['Tạm ứng chi phí', 'Hoàn ứng / Thanh toán chi phí'], required: true },
        { name: 'amount', label: 'Số tiền đề xuất (VNĐ)', type: 'number', required: true },
        { name: 'purpose', label: 'Mục đích chi tiêu', type: 'textarea', required: true },
        { name: 'bankAccount', label: 'Số tài khoản nhận tiền', type: 'text', required: true },
        { name: 'bankName', label: 'Tên ngân hàng', type: 'text', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'SUPER_ADMIN', label: 'Ban Giám Đốc phê duyệt chi' },
      ]),
      isActive: true,
    },
  });

  // 5.9 Đơn Xin Đi Công Tác
  await prisma.approvalTemplate.upsert({
    where: { code: 'BUSINESS_TRIP' },
    update: {},
    create: {
      name: 'Đơn Xin Đi Công Tác',
      code: 'BUSINESS_TRIP',
      icon: 'Plane',
      description: 'Đăng ký lịch đi công tác, khám chữa bệnh tuyến cơ sở hoặc gặp đối tác bên ngoài.',
      schemaFields: JSON.stringify([
        { name: 'destination', label: 'Địa điểm / Chi nhánh công tác', type: 'text', required: true },
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày công tác (tính đủ công)', type: 'number', required: true, default: 1.0 },
        { name: 'purpose', label: 'Mục đích & Kế hoạch công tác', type: 'textarea', required: true },
        { name: 'transportation', label: 'Phương tiện di chuyển', type: 'select', options: ['Xe công ty', 'Máy bay', 'Tàu hỏa', 'Xe khách', 'Phương tiện cá nhân'], required: true },
        { name: 'estimatedCost', label: 'Dự toán công tác phí (VNĐ)', type: 'number', required: false },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự ghi nhận công tác' },
      ]),
      isActive: true,
    },
  });

  // 5.10 Đơn Đi Học / Đào Tạo Đặc Cách
  await prisma.approvalTemplate.upsert({
    where: { code: 'TRAINING_REQUEST' },
    update: {},
    create: {
      name: 'Đơn Đi Học / Đào Tạo Nâng Cao (Đặc Cách)',
      code: 'TRAINING_REQUEST',
      icon: 'GraduationCap',
      description: 'Đăng ký tham gia khóa đào tạo chuyên môn Y khoa/Nha khoa (hưởng nguyên lương hoặc duyệt công đặc cách).',
      schemaFields: JSON.stringify([
        { name: 'courseName', label: 'Tên khóa đào tạo / Chuyên đề', type: 'text', required: true },
        { name: 'trainingInstitute', label: 'Đơn vị tổ chức / Bệnh viện', type: 'text', required: true },
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'overrideUnits', label: 'Số công đặc cách đề xuất / ngày', type: 'select', options: ['2.0 công (Làm từ 14h00 - 19h30 tính 2 ca)', '1.0 công (1 ca)', '3.0 công (Cả ngày đi học hưởng nguyên lương)'], required: true },
        { name: 'reason', label: 'Cam kết & Mục tiêu sau đào tạo', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DYNAMIC',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Trưởng khoa / Quản lý duyệt' },
        { stepOrder: 2, approverRole: 'HR_ADMIN', label: 'Phòng Nhân sự cập nhật công đặc cách' },
      ]),
      isActive: true,
    },
  });

  // 5.11 Đơn Xin Làm Việc Từ Xa (WFH)
  await prisma.approvalTemplate.upsert({
    where: { code: 'WFH_REQUEST' },
    update: {},
    create: {
      name: 'Đơn Xin Làm Việc Từ Xa (WFH)',
      code: 'WFH_REQUEST',
      icon: 'Laptop',
      description: 'Đăng ký làm việc tại nhà/từ xa cho khối văn phòng, Marketing, IT (tính đủ công theo KPI).',
      schemaFields: JSON.stringify([
        { name: 'startDate', label: 'Từ ngày', type: 'date', required: true },
        { name: 'endDate', label: 'Đến ngày', type: 'date', required: true },
        { name: 'duration', label: 'Số ngày WFH', type: 'number', required: true, default: 1.0 },
        { name: 'tasksPlan', label: 'Kế hoạch công việc & Deliverables trong ngày', type: 'textarea', required: true },
        { name: 'reason', label: 'Lý do xin WFH', type: 'textarea', required: true },
      ]),
      approvalFlowType: 'DIRECT_MANAGER',
      defaultSteps: JSON.stringify([
        { stepOrder: 1, approverRole: 'MANAGER', label: 'Quản lý trực tiếp duyệt KPI WFH' },
      ]),
      isActive: true,
    },
  });

  console.log('✅ Đã tạo danh mục đầy đủ các mẫu đơn phê duyệt chuẩn doanh nghiệp.');

  // 6. Cấu hình hệ thống (System Settings)
  await prisma.systemSetting.upsert({
    where: { key: 'COMPANY_NAME' },
    update: {},
    create: { key: 'COMPANY_NAME', value: 'PEACE MEDICAL & DENTAL HOLDINGS', description: 'Tên tổ chức / công ty' },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'GLOBAL_GRACE_PERIOD_LATE' },
    update: {},
    create: { key: 'GLOBAL_GRACE_PERIOD_LATE', value: '15', description: 'Số phút dung sai cho phép đi muộn (phút)' },
  });

  console.log('🎉 Khởi tạo dữ liệu mẫu thành công hoàn tất 100%!');
}

main()
  .catch((e) => {
    console.error('Lỗi khởi tạo seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
