import { Controller, Get, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@ApiTags('Health & Static Services')
@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'aitasker-backend' };
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads');
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // Giới hạn kích thước tệp 10MB
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded or file too large');
    }
    const host = process.env.BACKEND_URL || 'http://localhost:3000';
    return {
      url: `${host}/uploads/${file.filename}`,
      filename: file.filename,
    };
  }
}