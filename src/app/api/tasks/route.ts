export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET /api/tasks - Retrieve CRM tasks with filtering and status counts
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'ALL'
    const priority = searchParams.get('priority'); // 'LOW' | 'MEDIUM' | 'HIGH'
    const assignedTo = searchParams.get('assignedTo');
    const search = searchParams.get('search')?.trim();
    const dealId = searchParams.get('dealId');

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (priority && priority !== 'ALL') {
      where.priority = priority;
    }
    if (assignedTo && assignedTo !== 'ALL') {
      where.assignedTo = assignedTo;
    }
    if (dealId) {
      where.dealId = dealId;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { contactPhone: { contains: search } },
        { assignedTo: { contains: search } },
      ];
    }

    const [tasks, pendingCount, completedCount, totalCount] = await Promise.all([
      db.crmTask.findMany({
        where,
        orderBy: [
          { status: 'asc' }, // PENDING first
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
      db.crmTask.count({ where: { status: 'PENDING' } }),
      db.crmTask.count({ where: { status: 'COMPLETED' } }),
      db.crmTask.count(),
    ]);

    return NextResponse.json({
      success: true,
      tasks,
      metrics: {
        total: totalCount,
        pending: pendingCount,
        completed: completedCount,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Error in GET /api/tasks');
    return NextResponse.json({ error: err.message || 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new CRM Task
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, description, dueDate, priority, assignedTo, contactPhone, dealId } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
    const safePriority = validPriorities.includes(priority) ? priority : 'MEDIUM';

    let parsedDueDate: Date | null = null;
    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d.getTime())) {
        parsedDueDate = d;
      }
    }

    const task = await db.crmTask.create({
      data: {
        title: title.trim(),
        description: description ? String(description).trim() : null,
        dueDate: parsedDueDate,
        priority: safePriority,
        status: 'PENDING',
        assignedTo: assignedTo ? String(assignedTo).trim() : user.name || 'Unassigned',
        contactPhone: contactPhone ? String(contactPhone).replace(/[^0-9+]/g, '') : null,
        dealId: dealId ? String(dealId).trim() : null,
      },
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (err: any) {
    logger.error({ err }, 'Error in POST /api/tasks');
    return NextResponse.json({ error: err.message || 'Failed to create task' }, { status: 500 });
  }
}

// PUT /api/tasks - Update an existing CRM Task
export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, title, description, dueDate, priority, status, assignedTo, contactPhone, dealId } = body;

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title).trim();
    if (description !== undefined) updateData.description = description ? String(description).trim() : null;
    if (priority !== undefined) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
      if (validPriorities.includes(priority)) updateData.priority = priority;
    }
    if (status !== undefined) {
      const validStatuses = ['PENDING', 'COMPLETED', 'CANCELLED'];
      if (validStatuses.includes(status)) updateData.status = status;
    }
    if (dueDate !== undefined) {
      if (dueDate === null || dueDate === '') {
        updateData.dueDate = null;
      } else {
        const d = new Date(dueDate);
        if (!isNaN(d.getTime())) updateData.dueDate = d;
      }
    }
    if (assignedTo !== undefined) updateData.assignedTo = String(assignedTo).trim();
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone ? String(contactPhone).replace(/[^0-9+]/g, '') : null;
    if (dealId !== undefined) updateData.dealId = dealId ? String(dealId).trim() : null;

    const updated = await db.crmTask.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, task: updated });
  } catch (err: any) {
    logger.error({ err }, 'Error in PUT /api/tasks');
    return NextResponse.json({ error: err.message || 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks - Delete a task by ID
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }

    await db.crmTask.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Task deleted successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Error in DELETE /api/tasks');
    return NextResponse.json({ error: err.message || 'Failed to delete task' }, { status: 500 });
  }
}

