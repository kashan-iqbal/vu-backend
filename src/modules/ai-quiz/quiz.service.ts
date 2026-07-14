import { QuizModel } from "./quiz.model";

import { WrongAnswerModel } from "./wrongAnswer.model";



interface QuizWithSelection {
    id: number;
    question: string;
    topic_name: string;
    options: string[];
    correctAnswer: number;
    selectedOption: number;
    code: string;
    type: string;

}

export function filterWrongAnswers(data: QuizWithSelection[]): [QuizWithSelection[], QuizWithSelection[]] {
    const wrongAnswers = data.filter((quiz) => quiz.selectedOption !== quiz.correctAnswer);
    const correctAnswers = data.filter((quiz) => quiz.selectedOption === quiz.correctAnswer);

    return [wrongAnswers, correctAnswers];
}


export async function saveWrongAnswers(userId: string, wrongAnswers: QuizWithSelection[], correctAnswers: QuizWithSelection[]): Promise<void> {
    const topic = [...new Set(wrongAnswers.map((quiz) => quiz.topic_name))];
    await WrongAnswerModel.deleteMany({ userId, topic_name: { $in: topic } });

    const bulkOps = wrongAnswers.map((quiz) => ({
        updateOne: {
            filter: { userId, quizId: quiz.id },
            update: {
                $set: {
                    userId,
                    quizId: quiz.id,
                    code: quiz.code,       // ✅
                    type: quiz.type,       // ✅
                    topic_name: quiz.topic_name, // ✅
                },
            },
            upsert: true,
        },
    }));

    await WrongAnswerModel.bulkWrite(bulkOps);
}

export function buildQuizResult(data: QuizWithSelection[], wrongAnswers: QuizWithSelection[]) {
    return {
        totalQuestions: data.length,
        correct: data.length - wrongAnswers.length,
        wrong: wrongAnswers.length,
        wrongTopics: [...new Set(wrongAnswers.map((q) => q.topic_name))],
    };
}






export async function getSmartQuizService(userId: string, quizCode: string) {
    const [type, code] = quizCode.split("-");


    // Step 1: Get wrong topic_names for this user + course
    const wrongAnswers = await WrongAnswerModel.find(
        { userId, code, type },
        { topic_name: 1, _id: 0 }
    ).lean();

    const wrongTopics = [...new Set(wrongAnswers.map((w) => w.topic_name))];


    // Step 2: No wrong answers → send 15 fully random
    if (wrongTopics.length === 0) {
        return QuizModel.aggregate([
            { $match: { type, code } },
            { $sample: { size: 5 } }
        ]);
    }

    // Step 3: 10 from wrong topics + 5 random from other topics
    const [wrongTopicQuestions, randomQuestions] = await Promise.all([
        QuizModel.aggregate([
            { $match: { type, code, topic_name: { $in: wrongTopics } } },
            { $sample: { size: 10 } },
        ]),

        QuizModel.aggregate([
            { $match: { type, code, topic_name: { $nin: wrongTopics } } },
            { $sample: { size: 5 } },
        ]),
    ]);

    // Step 4: If wrong topics don't have enough questions fill remaining from random
    const combined = [...wrongTopicQuestions, ...randomQuestions];

    if (combined.length < 15) {
        const existingIds = combined.map((q) => q._id);
        const filler = await QuizModel.aggregate([
            { $match: { type, code, _id: { $nin: existingIds } } },
            { $sample: { size: 15 - combined.length } },
        ]);
        combined.push(...filler);
    }

    // Step 5: Shuffle final array so wrong topics aren't always first
    return combined.sort(() => Math.random() - 0.5);
}