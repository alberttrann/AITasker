import { IsNotEmpty, IsString } from "class-validator";

export class VerifyTaxCodeDto {
    @IsNotEmpty()
    @IsString()
    taxCode: string;
}