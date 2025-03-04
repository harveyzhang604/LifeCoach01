const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const app = express();
const port = 3000;

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// DeepSeek API配置
const API_KEY = process.env.API_KEY;
const API_URL = process.env.API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 处理聊天请求
app.post('/chat', async (req, res) => {
    try {
        // 设置响应头，启用流式输出
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const messages = req.body.messages || [];

        // 添加系统角色设定
        if (!messages.find(msg => msg.role === 'system')) {
            messages.unshift({
                role: 'system',
                content: '你是一位亲切的Life Coach，擅长用简单易懂的语言帮助他人。请用简短精炼的语言回答问题（每次回复控制在100-200字左右），避免过多专业术语，注重实用性和可操作性。'
            });
        }

        // 调用DeepSeek API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-r1-250120',
                messages: messages,
                temperature: 0.7,
                stream: true
            })
        });

        // 处理流式响应
        const text = await response.text();
        const lines = text.split('\n');

        for (const line of lines) {
            if (line.trim() === '') continue;
            if (line.trim() === 'data: [DONE]') {
                res.write('data: [DONE]\n\n');
                continue;
            }

            try {
                const jsonData = JSON.parse(line.replace('data: ', ''));
                if (jsonData.choices && jsonData.choices[0].delta.content) {
                    res.write(`data: ${JSON.stringify(jsonData.choices[0].delta)}\n\n`);
                }
            } catch (e) {
                console.error('解析响应数据出错:', e);
            }
        }

        res.end();
    } catch (error) {
        console.error('处理请求时出错:', error);
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});