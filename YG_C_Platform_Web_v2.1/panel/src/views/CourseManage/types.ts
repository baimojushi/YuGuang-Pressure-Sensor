export interface DeviceInfo {
  name: string;
  model: string;
  sn: string;
  online: boolean;
  battery: number;
  cameraNormal: boolean;
  synced: boolean;
  wifi: string;
  volume: number;
  version: string;
}

export interface SceneTask {
  name: string;
  desc: string;
  status: "success" | "warning" | "gray";
  statusText: string;
}

export interface ScheduleItem {
  id: string;
  time: string;
  period: string;
  name: string;
  status: "done" | "active" | "pending";
  meta: string;
  action: string;
}

export interface AlertItem {
  id: string;
  type: "danger" | "orange" | "blue";
  icon: string;
  title: string;
  desc: string;
  action: string;
}

export interface ChildProfile {
  nickname: string;
  gender: "male" | "female";
  birthday: string;
  grade: string;
}

export interface MenuOption {
  icon: string;
  iconColor: "blue" | "green" | "orange" | "purple" | "red" | "gray";
  text: string;
  value?: string;
  valueColor?: string;
  arrow?: boolean;
  badge?: string;
  onClick?: () => void;
}

export interface TemplateItem {
  icon: string;
  iconBg: string;
  name: string;
  desc: string;
  selected?: boolean;
}

export interface RewardItem {
  icon: string;
  iconBg: string;
  name: string;
  points: number;
}

export interface ExchangeRecord {
  icon: string;
  iconBg: string;
  name: string;
  points: number;
  status: "approved" | "rejected";
}

export interface PendingExchange {
  icon: string;
  iconBg: string;
  name: string;
  child: string;
  time: string;
  points: number;
}

export interface WeekdayOption {
  label: string;
  active: boolean;
}

export interface PermissionItem {
  name: string;
  status: string;
  page?: string;
}

export interface TaskSetting {
  name: string;
  desc: string;
  enabled: boolean;
}

export interface TroubleshootStep {
  num: number;
  title: string;
  desc: string;
}

export interface CourseItem {
  time: string;
  name: string;
}

export interface StoryRecord {
  icon: string;
  iconBg: string;
  name: string;
  time: string;
  duration: string;
  finished: boolean;
}

export interface ExerciseRecord {
  name: string;
  time: string;
  duration: string;
  finished: boolean;
}

export interface SuggestionItem {
  icon: string;
  iconBg: string;
  text: string;
}

export interface LegendItem {
  color: string;
  label: string;
  count: number;
}

export interface TrendPoint {
  day: string;
  value: number;
  percent: number;
}

export interface OptionChoice {
  title: string;
  desc: string;
  selected?: boolean;
}

export interface ContentCategory {
  icon: string;
  iconBg: string;
  name: string;
  desc: string;
  path: string;
}

export interface ContentItem {
  icon: string;
  name: string;
  duration: string;
  enabled: boolean;
}

export interface EntityRewardItem {
  icon: string;
  name: string;
  points: number;
  status: "available" | "locked";
}

export interface PointsRuleItem {
  icon: string;
  iconBg: string;
  text: string;
  points: string;
}

export interface PendingSyncItem {
  name: string;
  time: string;
  status: "pending" | "synced";
}

export interface HelpItem {
  title: string;
  desc: string;
}
