import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { UpdateMilestoneDoDItemDto } from "./dto/update-dod-item.dto";
import { PrismaService } from "../database/prisma.service";
import { CreateDodItemDto } from "./dto/create-dod-item.dto";

@Injectable()
export class DodService {
  constructor(private readonly prisma: PrismaService) { }

  async create(milestoneId: string, dto: CreateDodItemDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
    }

    return this.prisma.milestoneDodItem.create({
      data: {
        milestoneId: milestoneId,
        itemDescription: dto.item_description,
        isRequired: dto.is_required ?? true,
        status: 'PENDING',
        mapsToCriterionId: dto.maps_to_criterion_id || null,
      },
    });
  }

  async updateDodStatus(itemId: string, milestoneId: string, dto: UpdateMilestoneDoDItemDto) {
    const dodItem = await this.prisma.milestoneDodItem.findUnique({
      where: { id: itemId }
    });
    if (!dodItem) {
      throw new NotFoundException(`DoD item with ID ${itemId} not found`);
    }
    // Mục DoD bắt buộc thì không cho phép đặt là NOT_APPLICABLE
    if (dodItem.isRequired && dto.status === 'NOT_APPLICABLE')
      throw new BadRequestException(`Cannot mark a required DoD item as NOT_APPLICABLE`);

    // Mục DoD bắt buộc và hoàn thành -> yêu cầu phải có Note 
    if (dodItem.isRequired && dto.status !== 'COMPLETED' && !dto.completion_note)
      throw new BadRequestException(`Completion note is required for required DoD items when status is not COMPLETED`);

    return this.prisma.milestoneDodItem.update({
      where: { id: itemId },
      data: {
        status: dto.status,
        completionNote: dto.status === 'COMPLETED' ? dto.completion_note : null,
        notApplicableNote: dto.status === 'NOT_APPLICABLE' ? dto.not_applicable_note : null,
        completedAt: dto.status === 'COMPLETED' ? new Date() : null,
      }
    });
  }

  async list(milestoneId: string) {
    return this.prisma.milestoneDodItem.findMany({
      where: { milestoneId },
      orderBy: { id: 'asc' },
    });
  }

  async delete(itemId: string) {
    const item = await this.prisma.milestoneDodItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`DoD item ${itemId} not found.`);
    if (item.status !== 'PENDING') {
      throw new UnprocessableEntityException('Can only delete PENDING DoD items.');
    }
    return this.prisma.milestoneDodItem.delete({ where: { id: itemId } });
  }

  async createBulk(milestoneId: string, dto: { items: CreateDodItemDto[] }) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone cannot be found in database.');
    }

    const result = await this.prisma.milestoneDodItem.createMany({
      data: dto.items.map((item) => ({
        milestoneId: milestoneId,
        itemDescription: item.item_description,
        isRequired: item.is_required ?? true,
        status: 'PENDING',
        mapsToCriterionId: item.maps_to_criterion_id || null,
      })),
    });

    return { success: true, count: result.count };
  }
}

