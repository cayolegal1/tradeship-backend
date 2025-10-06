import { Prisma, User } from '@prisma/client';
import { GetItemsDto } from '../dto/get-items.dto';

interface BuildItemWhereArgs extends Partial<GetItemsDto> {
  user?: User;
}
export class TradeHelpers {
  static buildItemWhere({
    category,
    search,
    user,
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

    if (user) {
      where.NOT = {
        ownerId: user.id,
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
