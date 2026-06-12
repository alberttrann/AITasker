import { Injectable } from "@nestjs/common";
import { RegisterUserDto } from "./dto/register.dto";

@Injectable() // Act as a provider
export class AuthService {
  async register(registerDto: RegisterUserDto) {
    // 1. Receive req body from DTO cleanup 
    

    // 2. Check email existence

    
    // 3. Hash password


    // 4. Create user and save down to db
  }

}