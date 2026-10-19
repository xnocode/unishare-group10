import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

// Helper to determine the authenticated user from request
async function getAuthenticatedUser(req: NextRequest) {
  let email = req.headers.get("x-user-email");

  if (!email) {
    const userCookie = req.cookies.get("unishare_user")?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userCookie));
        if (parsed.email) email = parsed.email;
      } catch {
        // ignore JSON parse error
      }
    }
  }

  if (!email) {
    const url = new URL(req.url);
    const queryEmail = url.searchParams.get("email");
    if (queryEmail) email = queryEmail;
  }

  // Fallback to Farhana Rahman (the primary authenticated student profile across UniShare)
  if (!email) {
    email = "farhana@std.du.ac.bd";
  }

  email = email.trim().toLowerCase();

  // Find or create the user in the database
  let user = await db.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        fullName: email.includes("farhana") ? "Farhana Rahman" : "Campus Student",
        studentId: "DU-2023-8841",
        passwordHash: "student_verified_auth",
        verified: true,
        tokenBalance: 420,
      },
    });
  }

  return user;
}

// GET: Retrieve authenticated user's emergency contacts
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);

    let contacts = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" },
    });

    // Seed default contacts for Farhana Rahman if empty
    if (contacts.length === 0 && user.email === "farhana@std.du.ac.bd") {
      await db.emergencyContact.createMany({
        data: [
          {
            userId: user.id,
            name: "Farida Rahman (Mother)",
            phoneNumber: "+880 1711-234567",
            relationship: "Family contact",
            priority: 1,
          },
          {
            userId: user.id,
            name: "Tanvir Ahmed (Roommate)",
            phoneNumber: "+880 1819-876543",
            relationship: "Campus friend",
            priority: 2,
          },
        ],
      });

      contacts = await db.emergencyContact.findMany({
        where: { userId: user.id },
        orderBy: { priority: "asc" },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      contacts,
    });
  } catch (error) {
    console.error("Failed to fetch emergency contacts:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error fetching emergency contacts" },
      { status: 500 }
    );
  }
}

// POST: Add a new emergency contact (max 5)
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();

    const { name, phoneNumber, relationship, priority } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Contact name is required." },
        { status: 400 }
      );
    }

    if (!phoneNumber || !phoneNumber.trim()) {
      return NextResponse.json(
        { success: false, error: "Valid phone number is required." },
        { status: 400 }
      );
    }

    // Check maximum contact limit of 5
    const existingCount = await db.emergencyContact.count({
      where: { userId: user.id },
    });

    if (existingCount >= 5) {
      return NextResponse.json(
        { success: false, error: "Maximum of 5 emergency contacts allowed per student." },
        { status: 400 }
      );
    }

    // Determine priority (1-5)
    let targetPriority = typeof priority === "number" ? Math.max(1, Math.min(5, priority)) : existingCount + 1;

    // Shift existing contacts down if target priority is already taken
    const existingContacts = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" },
    });

    const isTaken = existingContacts.some((c) => c.priority === targetPriority);
    if (isTaken) {
      for (const c of existingContacts) {
        if (c.priority >= targetPriority && c.priority < 5) {
          await db.emergencyContact.update({
            where: { id: c.id },
            data: { priority: c.priority + 1 },
          });
        }
      }
    }

    const newContact = await db.emergencyContact.create({
      data: {
        userId: user.id,
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        relationship: (relationship || "Emergency Contact").trim(),
        priority: targetPriority,
      },
    });

    // Re-normalize priorities so they are strictly 1..N
    await normalizePriorities(user.id);

    const updatedList = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({
      success: true,
      contact: newContact,
      contacts: updatedList,
    });
  } catch (error) {
    console.error("Failed to add emergency contact:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error creating contact" },
      { status: 500 }
    );
  }
}

// PUT: Edit an emergency contact or reorder contacts
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const body = await req.json();

    // Case 1: Batch reorder by priority
    if (body.reorder && Array.isArray(body.reorder)) {
      const items: { id: string; priority: number }[] = body.reorder;

      // Ensure all contacts belong to authenticated user
      const userContacts = await db.emergencyContact.findMany({
        where: { userId: user.id },
      });
      const validIds = new Set(userContacts.map((c) => c.id));

      for (const item of items) {
        if (!validIds.has(item.id)) {
          return NextResponse.json(
            { success: false, error: "Access denied. Cannot reorder contacts that do not belong to you." },
            { status: 403 }
          );
        }
      }

      for (const item of items) {
        const clampedPriority = Math.max(1, Math.min(5, Number(item.priority) || 1));
        await db.emergencyContact.update({
          where: { id: item.id },
          data: { priority: clampedPriority },
        });
      }

      await normalizePriorities(user.id);

      const refreshed = await db.emergencyContact.findMany({
        where: { userId: user.id },
        orderBy: { priority: "asc" },
      });

      return NextResponse.json({
        success: true,
        contacts: refreshed,
      });
    }

    // Case 2: Update a single contact
    const { id, name, phoneNumber, relationship, priority } = body;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Contact ID is required." },
        { status: 400 }
      );
    }

    const existing = await db.emergencyContact.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Contact not found or access denied." },
        { status: 404 }
      );
    }

    const targetPriority =
      typeof priority === "number" ? Math.max(1, Math.min(5, priority)) : existing.priority;

    // If priority changed, swap or shift priorities
    if (targetPriority !== existing.priority) {
      const conflict = await db.emergencyContact.findFirst({
        where: {
          userId: user.id,
          priority: targetPriority,
          id: { not: id },
        },
      });

      if (conflict) {
        await db.emergencyContact.update({
          where: { id: conflict.id },
          data: { priority: existing.priority },
        });
      }
    }

    const updated = await db.emergencyContact.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phoneNumber: phoneNumber !== undefined ? phoneNumber.trim() : existing.phoneNumber,
        relationship: relationship !== undefined ? relationship.trim() : existing.relationship,
        priority: targetPriority,
      },
    });

    await normalizePriorities(user.id);

    const allContacts = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({
      success: true,
      contact: updated,
      contacts: allContacts,
    });
  } catch (error) {
    console.error("Failed to update emergency contact:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error updating contact" },
      { status: 500 }
    );
  }
}

// DELETE: Delete an emergency contact
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Contact ID is required." },
        { status: 400 }
      );
    }

    const existing = await db.emergencyContact.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: "Contact not found or access denied." },
        { status: 404 }
      );
    }

    await db.emergencyContact.delete({
      where: { id },
    });

    // Re-normalize priorities so 1..N order is continuous
    await normalizePriorities(user.id);

    const remaining = await db.emergencyContact.findMany({
      where: { userId: user.id },
      orderBy: { priority: "asc" },
    });

    return NextResponse.json({
      success: true,
      contacts: remaining,
    });
  } catch (error) {
    console.error("Failed to delete emergency contact:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error deleting contact" },
      { status: 500 }
    );
  }
}

// Utility: Normalize priorities cleanly to 1, 2, 3...
async function normalizePriorities(userId: string) {
  const contacts = await db.emergencyContact.findMany({
    where: { userId },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
  });

  for (let i = 0; i < contacts.length; i++) {
    const desiredPriority = i + 1;
    if (contacts[i].priority !== desiredPriority) {
      await db.emergencyContact.update({
        where: { id: contacts[i].id },
        data: { priority: desiredPriority },
      });
    }
  }
}

