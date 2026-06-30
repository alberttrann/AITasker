import { IsInt, IsPositive } from 'class-validator';

// PUT /bids/:id/counter-offer body. Per docs/04 §0.11 L row 162.
// negotiated_price_vnd is BIGINT in the schema; on the wire we accept it
// as a JSON number. (For values >2^53 VND the frontend would lose precision,
// but realistic VND bid prices fit comfortably in that range.)
export class CounterOfferDto {
  @IsInt()
  @IsPositive()
  negotiated_price_vnd!: number;
}
