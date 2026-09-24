
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
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
        { name: 'duration', label: 'Số công nghỉ', type: 'number', required: true, default: 1.0 },
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
        { name: 'duration', label: 'Số công nghỉ', type: 'number', required: true, default: 1.0 },
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
        { name: 'duration', label: 'Số công nghỉ', type: 'number', required: true, default: 1.0 },
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
        { name: 'duration', label: 'Số công nghỉ', type: 'number', required: true, default: 1.0 },
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
        { name: 'duration', label: 'Số công nghỉ', type: 'number', required: true, default: 1.0 },
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
}
main().catch(console.error).finally(() => prisma.$disconnect());
