import request from "@/utils/request";
import requestAgent from "@/utils/requestAgent";

export interface SpeakingEvaluationItem {
  id: number;
  score: string;
  createTime: string;
  sessionId: string;
  starRating: number;
}

export interface SpeakingEvaluationListData {
  result?: {
    content?: SpeakingEvaluationItem[];
  };
  ok?: boolean;
  msg: "";
  status?: number;
}
export interface deleteSpeakingEvaluationResultData {
  result?: {};
  ok?: boolean;
  msg: "";
  status?: number;
}

interface SentenceDetail {
  audio: string;
  score: string;
  time: string;
  text: string;
  id: number;
  isPlaying: boolean;
}
export interface SpeakingEvaluationResultDetail {
  category: string;
  starRating: number;
  description: string;
}

export interface SpeakingEvaluationDetail {
  sessionId: string;
  accuracyScore: string;
  completionScore: string;
  fluencyScore: string;
  score: string;
  userEnglishLevel: string;
  levelDescription: string;
  wordsEncourage: string;
  totalQuestions: number;
  createTime: string;
  error: string;
  sentenceDetail: SentenceDetail[];
  resultDetail: SpeakingEvaluationResultDetail[];
}

export interface SpeakingEvaluationDetailData {
  status?: number;
  result?: {
    content?: SpeakingEvaluationDetail;
  };
}

export async function fetchSpeakingEvaluationResultList(params: {
  pid: number | string;
  did: number | string;
}) {
  return (await requestAgent.get(
    "app/api/olap/querySpeakingEvaluationResultList",
    {
      params
    }
  )) as SpeakingEvaluationListData;
}

export async function fetchSpeakingEvaluationDetail(params: {
  sessionId: string;
}) {
  return (await requestAgent.get("app/api/olap/querySpeakingEvaluationDetail", {
    params
  })) as SpeakingEvaluationDetailData;
}

export async function deleteSpeakingEvaluationResult(params: {
  reportId: number;
}) {
  return (await requestAgent.delete(
    `app/api/olap/speaking/evaluations/${params.reportId}`
  )) as deleteSpeakingEvaluationResultData;
}
