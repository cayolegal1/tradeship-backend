import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type UploadedImageMetadata = {
  storagePath: string;
  url: string;
  originalName: string;
  mimeType?: string;
  fileSize?: number;
};

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('Supabase client initialized successfully');
    } else {
      this.logger.warn(
        'Supabase configuration not found. File upload features will be disabled.',
      );
    }
  }

  async uploadItemImages(
    itemId: number,
    images: Express.Multer.File[],
  ): Promise<UploadedImageMetadata[]> {
    if (!images || images.length === 0) {
      return [];
    }

    if (!this.supabase) {
      this.logger.warn('Supabase not configured. Skipping image upload.');
      return [];
    }

    const uploadedImages: UploadedImageMetadata[] = [];

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const fileExtension = image.originalname.split('.').pop();
      const fileName = `${itemId}_${Date.now()}_${i}.${fileExtension}`;
      const storagePath = `items/${itemId}/${fileName}`;

      try {
        const { error } = await this.supabase.storage
          .from('item-images')
          .upload(storagePath, image.buffer, {
            contentType: image.mimetype,
            upsert: false,
          });

        if (error) {
          this.logger.error(`Failed to upload image ${fileName}:`, error);
          throw new BadRequestException(
            `Failed to upload image: ${error.message}`,
          );
        }

        const { data: publicUrl } = this.supabase.storage
          .from('item-images')
          .getPublicUrl(storagePath);

        uploadedImages.push({
          storagePath,
          url: publicUrl.publicUrl,
          originalName: image.originalname,
          mimeType: image.mimetype,
          fileSize: image.size,
        });

        this.logger.log(`Successfully uploaded image: ${fileName}`);
      } catch (error) {
        this.logger.error(`Error uploading image ${fileName}:`, error);
        throw new BadRequestException(
          `Failed to upload image: ${error.message}`,
        );
      }
    }

    return uploadedImages;
  }

  async removeSupabaseFiles(paths: string[]): Promise<void> {
    if (!paths || paths.length === 0) {
      return;
    }

    if (!this.supabase) {
      this.logger.warn('Supabase not configured. Skipping file removal.');
      return;
    }

    try {
      const { error } = await this.supabase.storage
        .from('item-images')
        .remove(paths);

      if (error) {
        this.logger.error('Failed to remove files from Supabase:', error);
        throw new BadRequestException(
          `Failed to remove files: ${error.message}`,
        );
      }

      this.logger.log(
        `Successfully removed ${paths.length} files from Supabase`,
      );
    } catch (error) {
      this.logger.error('Error removing files from Supabase:', error);
      throw new BadRequestException(`Failed to remove files: ${error.message}`);
    }
  }

  async uploadSingleFile(
    file: Express.Multer.File,
    folder: string,
    fileName?: string,
  ): Promise<UploadedImageMetadata> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!this.supabase) {
      throw new BadRequestException(
        'File upload is not available. Supabase is not configured.',
      );
    }

    const fileExtension = file.originalname.split('.').pop();
    const finalFileName = fileName || `${Date.now()}.${fileExtension}`;
    const storagePath = `${folder}/${finalFileName}`;

    try {
      const { error } = await this.supabase.storage
        .from('uploads')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        this.logger.error(`Failed to upload file ${finalFileName}:`, error);
        throw new BadRequestException(
          `Failed to upload file: ${error.message}`,
        );
      }

      const { data: publicUrl } = this.supabase.storage
        .from('uploads')
        .getPublicUrl(storagePath);

      this.logger.log(`Successfully uploaded file: ${finalFileName}`);

      return {
        storagePath,
        url: publicUrl.publicUrl,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
      };
    } catch (error) {
      this.logger.error(`Error uploading file ${finalFileName}:`, error);
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  async deleteFile(
    storagePath: string,
    bucket: string = 'uploads',
  ): Promise<void> {
    if (!this.supabase) {
      this.logger.warn('Supabase not configured. Skipping file deletion.');
      return;
    }

    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([storagePath]);

      if (error) {
        this.logger.error(`Failed to delete file ${storagePath}:`, error);
        throw new BadRequestException(
          `Failed to delete file: ${error.message}`,
        );
      }

      this.logger.log(`Successfully deleted file: ${storagePath}`);
    } catch (error) {
      this.logger.error(`Error deleting file ${storagePath}:`, error);
      throw new BadRequestException(`Failed to delete file: ${error.message}`);
    }
  }

  async getFileUrl(
    storagePath: string,
    bucket: string = 'uploads',
  ): Promise<string> {
    if (!this.supabase) {
      throw new BadRequestException(
        'File URL retrieval is not available. Supabase is not configured.',
      );
    }

    try {
      const { data } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      return data.publicUrl;
    } catch (error) {
      this.logger.error(`Error getting file URL for ${storagePath}:`, error);
      throw new BadRequestException(`Failed to get file URL: ${error.message}`);
    }
  }

  validateImageFile(file: Express.Multer.File): void {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
      );
    }

    if (file.size > maxSize) {
      throw new BadRequestException(
        'File size too large. Maximum size is 5MB.',
      );
    }
  }

  validateFileType(file: Express.Multer.File, allowedTypes: string[]): void {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
      );
    }
  }

  validateFileSize(file: Express.Multer.File, maxSize: number): void {
    if (file.size > maxSize) {
      throw new BadRequestException(
        `File size too large. Maximum size is ${maxSize / (1024 * 1024)}MB.`,
      );
    }
  }
}
