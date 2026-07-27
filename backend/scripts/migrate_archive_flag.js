// One-off migration: move the old status === 'Archived' rows to the new model
// where archive is an independent flag. Restores each row's real status from
// previousStatus (falling back to 'To Apply') and sets isArchived = true.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const archived = await prisma.application.findMany({ where: { status: 'Archived' } });
    console.log(`Found ${archived.length} row(s) with status='Archived'.`);
    for (const app of archived) {
        const restored = app.previousStatus || 'To Apply';
        await prisma.application.update({
            where: { id: app.id },
            data: { status: restored, isArchived: true },
        });
        console.log(`  #${app.id} ${app.company} → status='${restored}', isArchived=true`);
    }
    console.log('Done.');
    await prisma.$disconnect();
}

run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
