const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        const appCount = await prisma.application.count();
        const userCount = await prisma.user.count();
        const users = await prisma.user.findMany({
            select: { id: true, email: true, name: true }
        });
        const appsWithUser = await prisma.application.findMany({
            select: { id: true, company: true, userId: true },
            take: 5
        });

        console.log('=== Database Status ===');
        console.log('Total Applications:', appCount);
        console.log('Total Users:', userCount);
        console.log('\nUsers:');
        console.log(JSON.stringify(users, null, 2));
        console.log('\nSample Applications:');
        console.log(JSON.stringify(appsWithUser, null, 2));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
