const fs = require('fs');
const path = 'd:/Workspace/AITasker/frontend/src/types/api.types.ts';
let content = fs.readFileSync(path, 'utf8');

const invitationDto = `

// ── Invitations ───────────────────────────────────────────────────────────────
export interface InvitationDto {
  id:          string;
  projectId:   string;
  expertId:    string;
  ceoId:       string;
  message:     string | null;
  status:      'PENDING' | 'ACCEPTED' | 'DECLINED';
  invitedAt:   string;
  respondedAt: string | null;
  expiresAt:   string | null;
  isExpired:   boolean;
  project: {
    id:                  string;
    projectName:         string;
    state:               string;
    archetype:           string;
    tier:                string;
    createdAt:           string;
    requiredDomainsJson: any[];
    requiredSeamsJson:   any[];
  };
  ceo: {
    id:       string;
    fullName: string;
  };
}
`;

if (!content.includes('interface InvitationDto')) {
  content += invitationDto;
  fs.writeFileSync(path, content);
  console.log('Added InvitationDto');
} else {
  console.log('InvitationDto already exists');
}
