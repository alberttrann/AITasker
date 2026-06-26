 ## Summary                                                   
                                                               
  ### Files Created / Modified                                 
                                                               
   File           │ Action
  ────────────────┼────────────────────────────────────────────
   ExpertWallet.tsx │ Created — Screen 14
   BankHubLink.tsx │ Created — Screen 15
   use-wallet.ts │ Modified — added  useUserProfile()  + 
                  │ useLinkBankAccount()  hooks
   App.tsx │ Modified — wired routes  /expert/wallet  → 
                  │ ExpertWallet ,  /expert/wallet/link-bank 
                  │ →  BankHubLink 
  
  ### Screen 14: Expert Wallet ( /expert/wallet )
  
  • Balance cards — Available + Locked balances via  GET       
  /wallets/me 
  • Profile header — Avatar, name, role badge, subscription    
  tier
  • Bank account status card — Reads  sepay_bank_account_xid   
  and  bank_linked_at  from  GET /users/me  to show "Linked ✅"
  or "Not Linked ❌"
  • "Link Bank Account" button — navigates to
  /expert/wallet/link-bank  when not linked
  • "Withdraw to Bank" button — shown when linked, disabled    
  with a "Soon" badge (MF-2 demo)
  • Transaction history — reuses the existing
  <TransactionHistory />  component
  
  ### Screen 15: Bank Hub Link ( /expert/wallet/link-bank )    
  
  • Info banner — explains SePay Bank Hub purpose
  • Form — Holder name + Bank account XID inputs
  • Submission — calls  POST /bank-hub/initiate-link  with  {  
  bank_account_xid, holder_name } 
  • Success state — shows a success card with "Back to Wallet" 
  button; also shown if user already has a linked bank         
  • Error handling — 409 → "A bank account is already linked to
  your profile.", other errors show the server message         
  
  ### New Hooks in  use-wallet.ts 
  
  •  useUserProfile()  —  GET /users/me , returns  UserDto ,   
  invalidated on bank link success
  •  useLinkBankAccount()  —  POST /bank-hub/initiate-link ,   
  auto-invalidates user profile on success