### HƯỚNG DẪN TÍCH HỢP FRONTEND CHI TIẾT (Vietnamese integration)

Dưới đây là kịch bản thay đổi mã nguồn chi tiết cho 2 tính năng ở phía Frontend.

---

### THAY ĐỔI 1: Bắt lỗi gõ bậy ở Stage 1 (`Stage1Symptoms.tsx`)

Mục tiêu là khi Backend ném lỗi `400 Bad Request` do AI không trích xuất được triệu chứng kỹ thuật, Frontend sẽ hiển thị lỗi đó lên giao diện để CEO hiểu và nhập lại tử tế hơn.

#### Cập nhật file `frontend/src/features/ceo/elicitation/Stage1Symptoms.tsx`:

```typescript
// Tìm hàm handleSubmit hiện tại và bọc bắt lỗi cụ thể từ response:

  const handleSubmit = async () => {
    if (!symptomText.trim() || symptomText.trim().length < minLength) return;
    setIsSubmitting(true);
    setShowResults(false);

    try {
      const data = await submitStage1(sessionId, symptomText.trim());
      const voids = (data.voidListJson as VoidItem[]) ?? [];

      if (voids.length === 0) {
        onComplete({
          voidListJson: [],
          symptomText: symptomText.trim(),
        });
      } else {
        setVoidList(voids);
        setAcknowledgedVoids(new Set());
        setShowResults(true);
      }
    } catch (err: any) {
      // TRÍCH XUẤT LỖI TỪ BACKEND (Ví dụ: lỗi 400 gõ bậy)
      const serverMessage = err?.response?.data?.message;
      const parsedMessage = Array.isArray(serverMessage) 
        ? serverMessage[0] 
        : serverMessage;

      onError(parsedMessage || "AI service is currently busy. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

---

### THAY ĐỔI 2: Xử lý link Tech Team cho tài khoản đã đăng nhập (`HandoffRegister.tsx`)

Mục tiêu là nếu người dùng đã đăng nhập, chúng ta không bắt họ đăng ký lại nữa. Thay vào đó, hiển thị màn hình xác nhận để họ "Claim" vai trò Tech Team trực tiếp vào tài khoản hiện có.

Cuộc thảo luận của team đang xoay quanh hai vấn đề thực tế rất lớn về mặt trải nghiệm người dùng (UX) và bảo mật:

1.  **Anti-gibberish (Chống gõ bậy) ở Stage 1:** Giai đoạn CEO mô tả vấn đề bằng ngôn ngữ tự nhiên. Hiện tại hệ thống chưa có bước chặn nếu họ gõ linh tinh (như *"asdfasdfasdf"* hoặc *"abc abc abc"*). Team muốn có giải pháp gọn nhẹ tương tự cơ chế Vagueness Check ở Stage 3 mà không làm phình to prompt hay tăng độ trễ của AI service.
2.  **Handoff Link cho tài khoản đã tồn tại (Tech Team Login):** Hiện tại, link bàn giao (handoff link) chỉ cho phép **đăng ký tài khoản mới** thông qua endpoint `POST /auth/register/handoff`. Nếu người được mời làm Tech Team đã có sẵn tài khoản trên hệ thống (ví dụ: đang làm Expert hoặc CEO ở dự án khác), họ sẽ bị kẹt vì không thể dùng email cũ để đăng ký tiếp (bị trùng email - 409 Conflict). Họ cần một luồng để **chấp nhận lời mời trực tiếp bằng tài khoản hiện tại** mà không cần tạo email rác.

Dưới đây là phân tích chi tiết và giải pháp khắc phục triệt để cho cả hai vấn đề trên.

---

### VẤN ĐỀ 1: Giải pháp chống gõ bậy ở Stage 1 (Anti-gibberish)

#### Phân tích phương án tối ưu:
Chúng ta không cần phải gọi thêm một prompt phụ để kiểm tra tính hợp lệ của văn bản. Bản thân AI service khi phân tích Stage 1 qua hàm `stage1Extract` (gọi tới `/llm/elicitation/stage1-extract`) sẽ cố gắng trích xuất danh sách các triệu chứng kỹ thuật (`symptoms`).
*   Nếu người dùng nhập văn bản vô nghĩa (gibberish), AI service sẽ **không thể trích xuất được bất kỳ symptom nào** và trả về mảng `symptoms: []`.
*   Ta chỉ cần tận dụng đặc điểm này ở Backend để chặn ngay lập tức và trả về lỗi `400 Bad Request` yêu cầu họ nhập chi tiết hơn.

#### Thực hiện thay đổi trong `backend/src/elicitation/elicitation.service.ts`:

```typescript
// backend/src/elicitation/elicitation.service.ts

  async processStage1(sessionId: string, symptomText: string, userId: string) {
    const session = await this.findSessionOrThrow(sessionId);
    this.assertOwnership(session, userId);
    this.assertStage(session, 1);

    const aiResponse = await this.fastapiClient.stage1Extract({
      symptom_text: symptomText,
    });

    // CHẶN GÕ BẬY: Nếu AI không trích xuất được bất kỳ triệu chứng kỹ thuật/nghiệp vụ nào
    if (!aiResponse.symptoms || aiResponse.symptoms.length === 0) {
      throw new BadRequestException(
        'Your description does not contain any recognizable technical or business symptoms. Please provide more detail about your project.'
      );
    }

    return this.prisma.elicitationSession.update({
      where: { id: sessionId },
      data: {
        currentStage:               2,
        stage1SymptomsJson:         aiResponse.symptoms as any,
        voidListJson:               aiResponse.voids as any,
        recommendedArchetypesJson:  (aiResponse.recommended_archetypes ?? []) as any,
        state:                      'IN_PROGRESS',
        updatedAt:                  new Date(),
      },
    });
  }
```

---

### VẤN ĐỀ 2: Giải pháp cho tài khoản đã tồn tại nhận link Tech Team

#### Phân tích phương án tối ưu:
Để xử lý việc một người dùng đã có tài khoản (Expert hoặc CEO) muốn dùng chính tài khoản đó làm Tech Team cho dự án được mời:
1.  Chúng ta sẽ thêm một endpoint mới: `POST /auth/claim-handoff`.
2.  Endpoint này yêu cầu đăng nhập (JWT Guard) và nhận vào `{ invite_token: string }`.
3.  Nó sẽ giải mã token để xác minh tính hợp lệ (chưa hết hạn, chưa bị dùng, đúng JTI hiện tại).
4.  Cập nhật tài khoản hiện tại: Thêm quyền `CLIENT_CEO` vào mảng `roles` (nếu chưa có), đổi `activeRole` thành `CLIENT`, đổi `clientSubtype` thành `TECH_TEAM`.
5.  Tạo hoặc cập nhật `TechTeamProfile` liên kết họ với CEO của dự án.
6.  Đánh dấu link đã sử dụng (`handoffConsumedAt = now()`) để đảm bảo tính duy nhất.
7.  Ký lại và trả về JWT mới cùng thông tin user cập nhật.

#### 1. Cập nhật `backend/src/auth/auth.controller.ts`:

```typescript
// backend/src/auth/auth.controller.ts

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('claim-handoff')
  claimHandoff(
    @CurrentUser() user: AuthUser,
    @Body('invite_token') inviteToken: string,
  ) {
    return this.authService.claimHandoff(user.id, inviteToken);
  }
```

#### 2. Cập nhật `backend/src/auth/auth.service.ts`:

```typescript
// backend/src/auth/auth.service.ts

  async claimHandoff(userId: string, inviteToken: string) {
    let payload: { sessionId: string; ceoId: string; jti: string; purpose: string };
    try {
      payload = await this.jwtService.verifyAsync(inviteToken);
    } catch {
      throw new UnauthorizedException('This invite link has expired or is invalid.');
    }

    if (payload.purpose !== 'tech-team-handoff') {
      throw new UnauthorizedException('Invalid invite token.');
    }

    const session = await this.prisma.elicitationSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session) {
      throw new UnauthorizedException(
        'This invite link refers to a session that no longer exists.',
      );
    }
    if (session.handoffTokenJti !== payload.jti) {
      throw new UnauthorizedException(
        'This invite link has been superseded by a newer one. Ask the CEO to resend.',
      );
    }
    if (session.handoffConsumedAt !== null) {
      throw new UnauthorizedException('This invite link has already been used.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return await this.prisma.$transaction(async (tx) => {
      const roles = user.roles as string[];
      const updatedRoles = Array.from(new Set([...roles, UserRoleItem.CLIENT_CEO]));

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          roles: updatedRoles,
          activeRole: ActiveRole.CLIENT,
          clientSubtype: ClientSubType.TECH_TEAM,
        },
      });

      // Tạo profile hoặc cập nhật liên kết mới sang CEO dự án này
      await tx.techTeamProfile.upsert({
        where: { userId },
        create: {
          userId,
          linkedClientId: payload.ceoId,
          linkedProjectId: null,
        },
        update: {
          linkedClientId: payload.ceoId,
          linkedProjectId: null,
        },
      });

      await tx.elicitationSession.update({
        where: { id: payload.sessionId },
        data: { handoffConsumedAt: new Date() },
      });

      const access_token = await this.jwtGeneratePayload(updatedUser);
      return {
        access_token,
        user: this.toAuthUserResponse(updatedUser),
      };
    });
  }
```

##### KỊCH BẢN PHỐI HỢP

1.  **Xử lý ở màn hình nhận Link (`/register/handoff/:token`):**
    *   **Trường hợp 1 (Chưa đăng nhập):** Hiện form Đăng ký như cũ. Khi đăng ký thành công, gọi `POST /auth/register/handoff`.
    *   **Trường hợp 2 (Đã đăng nhập sẵn):** Hệ thống phát hiện có `isAuthenticated === true`. Lúc này **không hiện form đăng ký nữa**, mà hiển thị một card xác nhận:
        > *"Bạn đang đăng nhập bằng tài khoản **[Tên User]**. Bạn có muốn tham gia dự án này với vai trò Tech Team không?"*
    *   Khi họ nhấn **"Đồng ý tham gia"**, Frontend gọi ngay:
        ```typescript
        apiClient.post('/auth/claim-handoff', { invite_token: token })
        ```
    *   Frontend nhận về `access_token` mới, tự động ghi đè lên token cũ trong `useAuthStore` để cập nhật quyền `TECH_TEAM` ngay lập tức, rồi điều hướng thẳng họ về Dashboard của Tech Team để điền tiếp Stage 4.

#### Đề xuất cập nhật cho file `frontend/src/features/tech-team/auth/HandoffRegister.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { Loader2, CheckCircle2, UserCheck, LogOut } from 'lucide-react';
import { apiClient } from '@/lib/api-client'; // Để gọi API claim

function decodeJwt(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch (e) {
    return null;
  }
}

export function HandoffRegister() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  // Đọc trạng thái đăng nhập từ Auth Store toàn cục
  const { isAuthenticated, user, setTokens, setUser, logout } = useAuthStore();
  const { registerHandoff, login } = useAuth();
  
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      navigate('/register/handoff/expired');
      return;
    }

    const payload = decodeJwt(token);
    if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
      navigate('/register/handoff/expired');
      return;
    }

    // Nếu CHƯA đăng nhập, điền sẵn email từ token nếu có
    if (!isAuthenticated && payload.email) {
      setEmail(payload.email);
    }
    
    if (payload.sessionId) {
      sessionStorage.setItem('handoff_sessionId', payload.sessionId);
    }

    setIsLoading(false);
  }, [token, navigate, isAuthenticated]);

  // Luồng xử lý cho tài khoản đã đăng nhập (Claim vai trò)
  const handleClaimHandoff = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.post('/auth/claim-handoff', {
        invite_token: token,
      });

      // Swap token cũ bằng token mới chứa quyền Tech Team vừa nhận
      setTokens(data.access_token, '');
      setUser(data.user);
      
      // Chuyển hướng thẳng về trang điền Stage 4 của Tech Team
      navigate('/tech-team', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to claim invite. This link might be invalid or used.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (isLoginMode) {
        await login.mutateAsync({ email, password });
      } else {
        await registerHandoff.mutateAsync({
          invite_token: token || '',
          email,
          fullName,
          password,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-8 shadow-xl">
        
        {/* HIỂN THỊ THÔNG BÁO LỖI NẾU CÓ */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 text-center font-medium">
            {error}
          </div>
        )}

        {/* ─── KỊCH BẢN A: ĐÃ ĐĂNG NHẬP (Claim Invite Flow) ─── */}
        {isAuthenticated ? (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <UserCheck size={32} />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Accept Invitation</h2>
              <p className="text-sm text-slate-500 leading-relaxed">
                Bạn đang đăng nhập bằng tài khoản <strong className="text-slate-900">{user?.fullName}</strong> ({user?.email}). Bạn có muốn sử dụng tài khoản này để tham gia dự án với vai trò Tech Team không?
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                onClick={handleClaimHandoff}
                disabled={isSubmitting}
                className="w-full py-3 font-bold"
                variant="primary"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                  </span>
                ) : (
                  'Accept & Join Tech Team'
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  logout(); // Đăng xuất để cho phép họ đăng ký/đăng nhập tài khoản khác
                  handleReset();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
              >
                <LogOut size={16} />
                Sign out to use another account
              </button>
            </div>
          </div>
        ) : (
          
          // ─── KỊCH BẢN B: CHƯA ĐĂNG NHẬP (Register/Login Form) ───
          <>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Tech Team {isLoginMode ? 'Login' : 'Registration'}
              </h2>
              <p className="text-sm text-slate-500">
                {isLoginMode ? 'Log in to accept invitation' : 'Complete registration to join the project.'}
              </p>
            </div>

            <form onSubmit={handleSubmitRegister} className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="email">Email</Label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => isLoginMode && setEmail(e.target.value)}
                  disabled={!isLoginMode}
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none ${
                    isLoginMode 
                      ? 'bg-white border-slate-200 text-slate-900 focus:border-primary' 
                      : 'bg-slate-50 border-slate-200 text-slate-500 cursor-not-allowed'
                  }`}
                />
              </div>

              {!isLoginMode && (
                <div className="space-y-2 text-left">
                  <Label htmlFor="fullName">Full Name</Label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="e.g. John Doe"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary outline-none"
                  />
                </div>
              )}

              <div className="space-y-2 text-left">
                <Label htmlFor="password">Password</Label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-primary outline-none"
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full py-2.5 mt-2"
                disabled={isSubmitting || !password || (!isLoginMode && !fullName)}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {isLoginMode ? 'Logging in...' : 'Registering...'}
                  </span>
                ) : (
                  isLoginMode ? 'Log In & Accept' : 'Register & Accept'
                )}
              </Button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setError(null);
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {isLoginMode ? "Need an account? Sign up" : "Already have an account? Log in"}
                </button>
              </div>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
```