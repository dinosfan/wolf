'use strict';
const DAYBREAK_ROLES={
 sentinel:{name:'파수꾼',emoji:'🛡️',team:'village',max:1,order:-10,desc:'다른 플레이어 카드에 보호막을 놓을 수 있습니다. 보호된 카드는 확인·이동·유물 부여가 금지됩니다.'},
 alpha_wolf:{name:'우두머리 늑대',emoji:'🐺',team:'wolf',max:1,order:11,desc:'늑대 확인 후 추가 가운데 늑대 카드와 다른 비늑대 플레이어 카드를 보지 않고 바꿉니다. 자신과 시작 늑대는 대상이 아닙니다.'},
 mystic_wolf:{name:'신비한 늑대',emoji:'🔮',team:'wolf',max:1,order:12,desc:'늑대 확인 후 다른 플레이어의 카드 한 장을 확인할 수 있습니다.'},
 dream_wolf:{name:'잠자는 늑대',emoji:'💤',team:'wolf',max:1,order:100,desc:'밤에는 깨어나지 않습니다. 다른 늑대와 하수인은 정체를 알 수 있습니다. 늑대팀 승리 조건을 따릅니다.'},
 apprentice_seer:{name:'견습 예언자',emoji:'🌱',team:'village',max:1,order:41,desc:'가운데 카드 한 장을 확인할 수 있습니다.'},
 investigator:{name:'초자연 조사관',emoji:'🕵️',team:'village',max:1,order:42,desc:'다른 플레이어 최대 두 명을 한 명씩 확인합니다. 늑대 또는 무두장이 카드가 나오면 확인을 멈추고 그 역할의 승리 조건으로 변합니다. 도플갱어·조사관 카드의 숨은 역할은 복사하지 않습니다.'},
 witch:{name:'마녀',emoji:'🧙',team:'village',max:1,order:51,desc:'가운데 카드 한 장을 볼 수 있습니다. 봤다면 반드시 자신을 포함한 플레이어 한 명의 카드와 교환하고, 돌아간 카드는 보지 않습니다.'},
 village_idiot:{name:'마을 바보',emoji:'🔄',team:'village',max:1,order:61,desc:'자신·가운데·보호된 카드를 제외하고 나머지 카드를 좌석 순서의 왼쪽 또는 오른쪽으로 한 칸 이동할 수 있습니다.'},
 revealer:{name:'공개자',emoji:'☀️',team:'village',max:1,order:90,desc:'다른 플레이어 카드 한 장을 공개할 수 있습니다. 실제 카드가 늑대 또는 무두장이면 공개하지 않고 덮습니다. 도플갱어·조사관은 숨은 역할에 관계없이 공개됩니다.'},
 curator:{name:'유물 관리인',emoji:'🎁',team:'village',max:1,order:91,desc:'자신을 제외한 보호되지 않은 카드에 무작위 유물을 놓을 수 있습니다. 밤이 끝나면 받은 사람만 유물을 확인합니다. 역할을 바꾸는 유물은 카드 역할보다 우선합니다.'},
 bodyguard:{name:'경호원',emoji:'💂',team:'village',max:1,order:100,desc:'밤 행동은 없습니다. 최종 경호원이 투표한 사람은 죽지 않습니다. 보호된 최고 득표자 대신 다음으로 많은 표를 받은 사람이 2표 이상이면 죽습니다.'}
};
const ARTIFACTS={
 wolf:{name:'늑대의 발톱',emoji:'🐾',role:'werewolf',desc:'당신은 늑대인간입니다. 카드에 적힌 역할 대신 늑대팀 승리 조건을 따릅니다.'},
 villager:{name:'주민의 낙인',emoji:'🏠',role:'villager',desc:'당신은 주민입니다. 사냥꾼·경호원 같은 원래 카드의 효과도 사라집니다.'},
 tanner:{name:'무두장이의 곤봉',emoji:'🪓',role:'tanner',desc:'당신은 무두장이입니다. 자신이 죽어야 승리합니다.'},
 nothing:{name:'무의 공허',emoji:'⭕',desc:'효과가 없습니다. 카드 역할을 그대로 따릅니다.'},
 mute:{name:'침묵의 가면',emoji:'🤐',desc:'게임이 끝날 때까지 말하지 마세요. 몸짓·손짓·수어로는 소통할 수 있습니다.'},
 shame:{name:'수치의 장막',emoji:'🙈',desc:'게임이 끝날 때까지 몸과 얼굴을 돌리고 말하지 마세요. 다른 사람·카드·유물을 보지 마세요. 투표는 이 화면의 이름 버튼으로 선택합니다.'}
};
if(typeof module!=='undefined')module.exports={DAYBREAK_ROLES,ARTIFACTS};
