const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("--- Inspecting Current Users ---");
  const users = await prisma.user.findMany();
  console.log("Total users:", users.length);
  for (const u of users) {
    console.log(`User: ${u.email} | ${u.fullName} | Verified: ${u.verified} | Gender: ${u.gender}`);
  }

  // 1. Ensure Farhana Rahman (Logged-in demo user) is verified, female
  const farhana = await prisma.user.upsert({
    where: { email: "farhana@std.du.ac.bd" },
    update: {
      fullName: "Farhana Rahman",
      university: "University of Dhaka",
      department: "Computer Science & Engineering",
      verified: true,
      emailVerified: true,
      gender: "female",
    },
    create: {
      email: "farhana@std.du.ac.bd",
      fullName: "Farhana Rahman",
      university: "University of Dhaka",
      department: "Computer Science & Engineering",
      verified: true,
      emailVerified: true,
      passwordHash: "demo_hash",
      gender: "female",
      tokenBalance: 50,
    },
  });
  console.log("Upserted Farhana:", farhana.email, farhana.gender);

  // 2. Ensure Sadia Rahman is verified, female student with a journey to TSC, University of Dhaka
  const sadia = await prisma.user.upsert({
    where: { email: "sadia@std.du.ac.bd" },
    update: {
      fullName: "Sadia Rahman",
      university: "University of Dhaka",
      department: "Economics",
      verified: true,
      emailVerified: true,
      gender: "female",
    },
    create: {
      email: "sadia@std.du.ac.bd",
      fullName: "Sadia Rahman",
      university: "University of Dhaka",
      department: "Economics",
      verified: true,
      emailVerified: true,
      passwordHash: "demo_hash",
      gender: "female",
      tokenBalance: 50,
    },
  });
  console.log("Upserted Sadia:", sadia.email, sadia.gender);

  // 3. Ensure Tanvir Ahmed is verified, male student with a journey to TSC, University of Dhaka
  const tanvir = await prisma.user.upsert({
    where: { email: "tanvir@std.du.ac.bd" },
    update: {
      fullName: "Tanvir Ahmed",
      university: "University of Dhaka",
      department: "Physics",
      verified: true,
      emailVerified: true,
      gender: "male",
    },
    create: {
      email: "tanvir@std.du.ac.bd",
      fullName: "Tanvir Ahmed",
      university: "University of Dhaka",
      department: "Physics",
      verified: true,
      emailVerified: true,
      passwordHash: "demo_hash",
      gender: "male",
      tokenBalance: 50,
    },
  });
  console.log("Upserted Tanvir:", tanvir.email, tanvir.gender);

  // 4. Ensure Unverified user exists (should NEVER appear in search)
  // notehub3c2@gmail.com has verified: false
  const unverifiedUser = await prisma.user.findUnique({
    where: { email: "notehub3c2@gmail.com" },
  });
  if (unverifiedUser) {
    console.log("Confirmed unverified user in DB:", unverifiedUser.email, "verified =", unverifiedUser.verified);
  }

  // 5. Create real active travel journeys for Sadia (female) and Tanvir (male)
  await prisma.travelJourney.deleteMany({}); // Clear old test journeys

  // Sadia travelling from Dhanmondi 27 to TSC, University of Dhaka (Women Only or No Preference)
  const journey1 = await prisma.travelJourney.create({
    data: {
      userId: sadia.id,
      origin: "Dhanmondi 27, Dhaka",
      originLat: 23.7550,
      originLng: 90.3720,
      destination: "TSC, University of Dhaka",
      destinationLat: 23.7317,
      destinationLng: 90.3957,
      genderPreference: "women_only",
      status: "ACTIVE",
      notes: "Heading to DU library for morning seminar. Walking or taking shared rickshaw from Dhanmondi 27.",
    },
  });
  console.log("Created Sadia's Journey:", journey1.id, "to", journey1.destination, "pref:", journey1.genderPreference);

  // Tanvir travelling from Farmgate to TSC, University of Dhaka (No Preference)
  const journey2 = await prisma.travelJourney.create({
    data: {
      userId: tanvir.id,
      origin: "Farmgate, Dhaka",
      originLat: 23.7580,
      originLng: 90.3900,
      destination: "TSC, University of Dhaka",
      destinationLat: 23.7317,
      destinationLng: 90.3957,
      genderPreference: "no_preference",
      status: "ACTIVE",
      notes: "Traveling towards Curzon/TSC science faculty around 10:30 AM.",
    },
  });
  console.log("Created Tanvir's Journey:", journey2.id, "to", journey2.destination, "pref:", journey2.genderPreference);

  // If unverified user created a journey, it should STILL never appear because user.verified === false!
  if (unverifiedUser) {
    await prisma.travelJourney.create({
      data: {
        userId: unverifiedUser.id,
        origin: "Science Lab, Dhaka",
        destination: "TSC, University of Dhaka",
        genderPreference: "no_preference",
        status: "ACTIVE",
        notes: "Unverified student journey that must never be shown",
      },
    });
    console.log("Created unverified journey for testing filter integrity.");
  }

  console.log("Seed verification complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
