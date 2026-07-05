import 'dotenv/config';
import prisma from './src/lib/prisma';

async function main() {
  console.log('Seeding foundation data...');

  const faculty = await prisma.faculty.upsert({
    where: { code: 'F01' },
    update: {},
    create: {
      code: 'F01',
      name: 'คณะวิทยาศาสตร์',
    },
  });

  const dept = await prisma.department.upsert({
    where: { code: 'D01' },
    update: {},
    create: {
      code: 'D01',
      name: 'วิทยาการคอมพิวเตอร์',
      facultyId: faculty.id,
    },
  });

  const semester = await prisma.semester.create({
    data: {
      name: 'ภาคเรียนที่ 1/2567',
      academicYear: 2567,
      semesterNumber: 1,
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-10-31'),
      isCurrent: true,
    },
  });

  console.log('Foundation data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
