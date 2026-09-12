import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const status = searchParams.get('status');
    const templateCode = searchParams.get('templateCode');
    const creatorId = searchParams.get('creatorId');
    const approverId = searchParams.get('approverId');

    let whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (templateCode) {
      whereClause.template = { code: templateCode };
    }

    if (creatorId) {
      whereClause.creatorId = creatorId;
    }

    if (approverId) {
      whereClause.steps = {
        some: {
          approverId: approverId,
        },
      };
    }

    if (fromDate || toDate) {
      whereClause.createdAt = {};
      if (fromDate) {
        whereClause.createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
      }
      if (toDate) {
        whereClause.createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);
      }
    }

    // Role-based visibility scoping
    if (user.role === 'EMPLOYEE') {
      whereClause.OR = [
        { creatorId: user.id },
        { steps: { some: { approverId: user.id } } },
      ];
    } else if (user.role === 'MANAGER' && user.departmentId) {
      whereClause.OR = [
        { creatorId: user.id },
        { creator: { departmentId: user.departmentId } },
        { steps: { some: { approverId: user.id } } },
      ];
    }

    const requests = await prisma.approvalRequest.findMany({
      where: whereClause,
      include: {
        template: true,
        creator: {
          select: {
            name: true,
            employeeCode: true,
            position: true,
            department: { select: { name: true } },
            branch: { select: { name: true } },
          },
        },
        steps: {
          include: {
            approver: {
              select: {
                name: true,
                employeeCode: true,
                position: true,
              },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PEACE GapoWork';
    workbook.created = new Date();

    // ================= SHEET 1: SỔ THEO DÕI PHÊ DUYỆT =================
    const ws = workbook.addWorksheet('Sổ Phê Duyệt');

    // Title
    ws.mergeCells('A1:L1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'BÁO CÁO TỔNG HỢP & THEO DÕI ĐƠN PHÊ DUYỆT DOANH NGHIỆP';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00BA74' } };
    ws.getRow(1).height = 36;

    // Subtitle
    ws.mergeCells('A2:L2');
    const subCell = ws.getCell('A2');
    subCell.value = `Xuất ngày: ${new Date().toLocaleDateString('vi-VN')} | Người xuất: ${user.name} (${user.employeeCode}) | Tổng số phiếu: ${requests.length}`;
    subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF555555' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 22;

    // Table Headers
    const headers = [
      'STT',
      'Mã Phiếu',
      'Loại Phiếu',
      'Người Tạo (Người Được Duyệt)',
      'Phòng Ban',
      'Ngày Gửi',
      'Nội Dung / Lý Do',
      'Người Duyệt C1',
      'Ý Kiến C1',
      'Người Duyệt C2',
      'Ý Kiến C2',
      'Trạng Thái Cuối',
    ];

    const headerRow = ws.addRow(headers);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF999999' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });

    // Populate Data Rows
    requests.forEach((reqItem, idx) => {
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(reqItem.data || '{}');
      } catch (e) {}

      const step1 = reqItem.steps.find((s) => s.stepOrder === 1);
      const step2 = reqItem.steps.find((s) => s.stepOrder === 2);

      const statusMap: { [k: string]: string } = {
        APPROVED: 'Đã duyệt',
        REJECTED: 'Bị từ chối',
        PENDING: 'Đang chờ',
      };

      const row = ws.addRow([
        idx + 1,
        reqItem.code,
        reqItem.template.name,
        `${reqItem.creator.name} (${reqItem.creator.employeeCode})`,
        reqItem.creator.department?.name || 'N/A',
        new Date(reqItem.createdAt).toLocaleDateString('vi-VN'),
        parsedData.reason || parsedData.purpose || parsedData.taskDescription || '—',
        step1 ? `${step1.approver?.name || step1.approverRole || 'Quản lý'} (${step1.status})` : '—',
        step1?.note || '—',
        step2 ? `${step2.approver?.name || step2.approverRole || 'HR'} (${step2.status})` : '—',
        step2?.note || '—',
        statusMap[reqItem.status] || reqItem.status,
      ]);

      row.height = 24;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        // Alignments
        if (colNum === 1 || colNum === 2 || colNum === 6 || colNum === 12) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }

        // Status highlight
        if (colNum === 12) {
          if (reqItem.status === 'APPROVED') {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF059669' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
          } else if (reqItem.status === 'REJECTED') {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFE11D48' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
          } else {
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFD97706' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          }
        }
      });
    });

    // Auto fit column widths
    ws.columns = [
      { width: 6 },  // STT
      { width: 18 }, // Mã phiếu
      { width: 22 }, // Loại phiếu
      { width: 26 }, // Người tạo
      { width: 20 }, // Phòng ban
      { width: 14 }, // Ngày gửi
      { width: 30 }, // Nội dung
      { width: 24 }, // Người duyệt C1
      { width: 24 }, // Ý kiến C1
      { width: 24 }, // Người duyệt C2
      { width: 24 }, // Ý kiến C2
      { width: 16 }, // Trạng thái
    ];

    // ================= SHEET 2: THỐNG KÊ TỔNG HỢP =================
    const wsStats = workbook.addWorksheet('Thống Kê Tổng Hợp');
    wsStats.mergeCells('A1:E1');
    const statsTitle = wsStats.getCell('A1');
    statsTitle.value = 'THỐNG KÊ TỶ LỆ DUYỆT THEO LOẠI ĐƠN';
    statsTitle.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    statsTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    statsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    wsStats.getRow(1).height = 30;

    const statsHeader = wsStats.addRow(['Loại Mẫu Đơn', 'Tổng Số Đơn', 'Đã Duyệt', 'Bị Từ Chối', 'Chờ Duyệt']);
    statsHeader.height = 24;
    statsHeader.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Compute template stats
    const tplMap: { [k: string]: { name: string; total: number; approved: number; rejected: number; pending: number } } = {};
    for (const r of requests) {
      const code = r.template.code;
      if (!tplMap[code]) {
        tplMap[code] = { name: r.template.name, total: 0, approved: 0, rejected: 0, pending: 0 };
      }
      tplMap[code].total++;
      if (r.status === 'APPROVED') tplMap[code].approved++;
      else if (r.status === 'REJECTED') tplMap[code].rejected++;
      else tplMap[code].pending++;
    }

    Object.values(tplMap).forEach((st) => {
      const row = wsStats.addRow([st.name, st.total, st.approved, st.rejected, st.pending]);
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { horizontal: colNum === 1 ? 'left' : 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    });

    wsStats.columns = [
      { width: 26 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Bao_Cao_Phe_Duyet_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting approvals excel:', error);
    return NextResponse.json({ error: 'Lỗi xuất báo cáo Excel phê duyệt' }, { status: 500 });
  }
}
