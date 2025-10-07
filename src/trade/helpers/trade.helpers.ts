import { Prisma } from '@prisma/client';
import { GetItemsDto } from '../dto/get-items.dto';

interface BuildItemWhereArgs extends Partial<GetItemsDto> {
  userId?: number;
  ownerId?: number;
}
export class TradeHelpers {
  static buildItemWhere({
    category,
    search,
    userId,
    ownerId,
  }: BuildItemWhereArgs): Prisma.ItemWhereInput {
    const where: Prisma.ItemWhereInput = {
      isActive: true,
      isAvailableForTrade: true,
    };

    const numericCategory = Number(category);

    if (!isNaN(numericCategory) && numericCategory > 0) {
      where.interests = { some: { id: numericCategory } };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // If ownerId is provided, filter by specific owner (for getUserItems)
    if (ownerId) {
      where.ownerId = ownerId;
    } else if (userId) {
      // If user is provided but no ownerId, exclude user's items (for general search)
      where.NOT = {
        ownerId: userId,
      };
    }

    return where;
  }

  static buildItemOrderBy(sort?: string): Prisma.ItemOrderByWithRelationInput {
    const allowedFields = ['createdAt', 'name', 'price', 'updatedAt'];
    const [field, direction] = (sort || '').split(':');

    if (field && allowedFields.includes(field)) {
      return { [field]: direction === 'asc' ? 'asc' : 'desc' };
    }

    return { createdAt: 'desc' };
  }
}
