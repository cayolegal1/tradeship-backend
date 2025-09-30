import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create notification types
  const notificationTypes = [
    {
      name: 'trade_request',
      displayName: 'Trade Request',
      description: 'Someone wants to trade with you',
      priority: 'NORMAL' as any,
      requiresAction: true,
    },
    {
      name: 'trade_accepted',
      displayName: 'Trade Accepted',
      description: 'Your trade request has been accepted',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'trade_declined',
      displayName: 'Trade Declined',
      description: 'Your trade request has been declined',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'trade_completed',
      displayName: 'Trade Completed',
      description: 'A trade has been completed',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'trade_cancelled',
      displayName: 'Trade Cancelled',
      description: 'A trade has been cancelled',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'message_received',
      displayName: 'Message Received',
      description: 'You have received a new message',
      priority: 'NORMAL' as any,
      requiresAction: true,
    },
    {
      name: 'item_liked',
      displayName: 'Item Liked',
      description: 'Someone liked your item',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'item_comment',
      displayName: 'Item Comment',
      description: 'Someone commented on your item',
      priority: 'NORMAL' as any,
      requiresAction: true,
    },
    {
      name: 'profile_viewed',
      displayName: 'Profile Viewed',
      description: 'Someone viewed your profile',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'system_announcement',
      displayName: 'System Announcement',
      description: 'Important system announcement',
      priority: 'HIGH',
      requiresAction: false,
    },
    {
      name: 'account_security',
      displayName: 'Account Security',
      description: 'Important security notification',
      priority: 'URGENT',
      requiresAction: true,
    },
    {
      name: 'payment_received',
      displayName: 'Payment Received',
      description: 'You have received a payment',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'payment_sent',
      displayName: 'Payment Sent',
      description: 'You have sent a payment',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'rating_received',
      displayName: 'Rating Received',
      description: 'You have received a new rating',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'item_expired',
      displayName: 'Item Expired',
      description: 'Your item listing has expired',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'promotion',
      displayName: 'Promotion',
      description: 'Special promotion available',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'reminder',
      displayName: 'Reminder',
      description: 'Reminder notification',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'chat_message',
      displayName: 'Chat Message',
      description: 'New chat message',
      priority: 'NORMAL' as any,
      requiresAction: true,
    },
    {
      name: 'chat_typing',
      displayName: 'Chat Typing',
      description: 'Someone is typing in chat',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'chat_read',
      displayName: 'Chat Read',
      description: 'Message has been read',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'chat_group_created',
      displayName: 'Group Chat Created',
      description: 'A new group chat has been created',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'chat_group_joined',
      displayName: 'Joined Group Chat',
      description: 'You have joined a group chat',
      priority: 'NORMAL' as any,
      requiresAction: false,
    },
    {
      name: 'chat_group_left',
      displayName: 'Left Group Chat',
      description: 'You have left a group chat',
      priority: 'LOW',
      requiresAction: false,
    },
    {
      name: 'chat_mention',
      displayName: 'Mentioned in Chat',
      description: 'You have been mentioned in a chat',
      priority: 'NORMAL' as any,
      requiresAction: true,
    },
  ];

  for (const type of notificationTypes) {
    await prisma.notificationType.upsert({
      where: { name: type.name },
      update: type,
      create: type,
    });
  }

  // Create default interests
  const interests = [
    {
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      color: '#007bff',
    },
    {
      name: 'Collectibles',
      description: 'Rare and valuable collectible items',
      color: '#28a745',
    },
    { name: 'Books', description: 'Books and literature', color: '#ffc107' },
    {
      name: 'Clothing',
      description: 'Fashion and clothing items',
      color: '#dc3545',
    },
    {
      name: 'Sports',
      description: 'Sports equipment and memorabilia',
      color: '#17a2b8',
    },
    {
      name: 'Art',
      description: 'Artwork and artistic items',
      color: '#6f42c1',
    },
    {
      name: 'Jewelry',
      description: 'Jewelry and accessories',
      color: '#fd7e14',
    },
    { name: 'Toys', description: 'Toys and games', color: '#20c997' },
    {
      name: 'Home & Garden',
      description: 'Home and garden items',
      color: '#6c757d',
    },
    {
      name: 'Automotive',
      description: 'Automotive parts and accessories',
      color: '#343a40',
    },
  ];

  for (const interest of interests) {
    await prisma.interest.upsert({
      where: { name: interest.name },
      update: interest,
      create: interest,
    });
  }

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
