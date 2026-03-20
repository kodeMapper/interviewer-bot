const SESSION_STATE_ENUM = [
  'INTRO',
  'SKILL_PROMPT',
  'RESUME_WARMUP',
  'RESUME_DEEP_DIVE',
  'DEEP_DIVE',
  'MIX_ROUND',
  'FINISHED'
];

function jsonResponse(schema, example) {
  return {
    description: 'JSON response',
    content: {
      'application/json': {
        schema,
        ...(example ? { example } : {})
      }
    }
  };
}

function getOpenApiDocument() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'SkillWise — Interviewer Bot',
      version: '1.0.0',
      description: [
        'SkillWise is an AI-powered interview and proctoring platform.',
        '',
        'This workspace covers the **Interviewer Bot** service: interview orchestration,',
        'question-bank browsing, resume processing, session analytics,',
        'and proxy routes that connect to the standalone Proctoring System.'
      ].join('\n')
    },
    servers: [
      {
        url: '/',
        description: 'Current Express server origin'
      }
    ],
    tags: [
      { name: 'System', description: 'Health and service reachability.' },
      { name: 'Interview', description: 'Interview session lifecycle and reporting.' },
      { name: 'Questions', description: 'Question bank browsing and search.' },
      { name: 'Resume', description: 'Resume upload and generated follow-up questions.' },
      { name: 'Sessions', description: 'Session history and analytics.' },
      { name: 'Proctoring Proxy', description: 'Express routes that proxy to the standalone proctoring API.' }
    ],
    components: {
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Session not found' },
            details: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        InterviewStartRequest: {
          type: 'object',
          required: ['skills'],
          properties: {
            skills: {
              type: 'array',
              minItems: 1,
              items: { type: 'string' },
              example: ['JavaScript', 'React', 'SQL']
            },
            resumePath: {
              type: 'string',
              nullable: true,
              example: 'uploads/resume-12345.pdf'
            }
          }
        },
        ResumeUploadRequest: {
          type: 'object',
          required: ['resume', 'sessionId'],
          properties: {
            resume: {
              type: 'string',
              format: 'binary',
              description: 'PDF, DOC, or DOCX file up to 10MB'
            },
            sessionId: {
              type: 'string',
              description: 'Existing interview session id'
            }
          }
        }
      }
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Check Express backend health',
          responses: {
            200: jsonResponse(
              {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  environment: { type: 'string' },
                  uptime: { type: 'number' }
                }
              },
              {
                status: 'ok',
                timestamp: '2026-03-20T09:30:00.000Z',
                environment: 'development',
                uptime: 42.18
              }
            )
          }
        }
      },
      '/api/interview/start': {
        post: {
          tags: ['Interview'],
          summary: 'Create a new interview session',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InterviewStartRequest' }
              }
            }
          },
          responses: {
            201: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessionId: '67c1b2c3d4e5f67890123456',
                  state: 'INTRO',
                  skills: ['JavaScript', 'React', 'SQL'],
                  message: 'Interview session created. Connect via WebSocket to begin.'
                }
              }
            ),
            400: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/interview/session/{sessionId}': {
        get: {
          tags: ['Interview'],
          summary: 'Get interview session overview',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'MongoDB session id'
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessionId: '67c1b2c3d4e5f67890123456',
                  state: 'DEEP_DIVE',
                  questionsAsked: 10,
                  currentTopic: 'Python',
                  skillsDetected: ['Python', 'React'],
                  skillsQueue: ['Python', 'React'],
                  answersCount: 8,
                  startedAt: '2026-03-20T09:30:00.000Z',
                  endedAt: null,
                  duration: 14
                }
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/interview/session/{sessionId}/end': {
        post: {
          tags: ['Interview'],
          summary: 'End an interview session',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessionId: '67c1b2c3d4e5f67890123456',
                  state: 'FINISHED',
                  finalScore: 81,
                  duration: 24,
                  questionsAnswered: 20
                }
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/interview/session/{sessionId}/report': {
        get: {
          tags: ['Interview'],
          summary: 'Get the generated interview report',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  summary: { totalQuestions: 20, answered: 18, skipped: 2, avgScore: 78 },
                  topicBreakdown: [{ topic: 'Python', avgScore: 82, count: 5 }],
                  finalScore: 81
                }
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/questions/topic/{topic}': {
        get: {
          tags: ['Questions'],
          summary: 'List questions for a topic',
          parameters: [
            {
              name: 'topic',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'For example Java, Python, React, SQL'
            },
            {
              name: 'page',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 1 }
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 10 }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  questions: [
                    {
                      question: 'Explain the virtual DOM in React.',
                      expectedAnswer: 'A lightweight tree representation used to optimize DOM updates.',
                      keywords: ['virtual dom', 'diffing', 'render'],
                      difficulty: 'medium'
                    }
                  ],
                  pagination: { total: 47, page: 1, pages: 5 }
                }
              }
            ),
            400: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/questions/search': {
        get: {
          tags: ['Questions'],
          summary: 'Search questions by keyword',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'topics',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Comma-separated topic filter'
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  query: 'hooks',
                  results: [
                    {
                      question: 'What problem do React hooks solve?',
                      difficulty: 'medium'
                    }
                  ],
                  count: 1
                }
              }
            ),
            400: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/questions/stats': {
        get: {
          tags: ['Questions'],
          summary: 'Get question bank statistics',
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  totalQuestions: 330,
                  topicStats: [{ topic: 'React', count: 47, avgTimesAsked: 3, avgScore: 65 }]
                }
              }
            )
          }
        }
      },
      '/api/questions/topics': {
        get: {
          tags: ['Questions'],
          summary: 'List all available topics',
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  topics: ['Java', 'Python', 'JavaScript', 'React'],
                  count: 4
                }
              }
            )
          }
        }
      },
      '/api/resume/upload': {
        post: {
          tags: ['Resume'],
          summary: 'Upload a resume for parsing and question generation',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: { $ref: '#/components/schemas/ResumeUploadRequest' }
              }
            }
          },
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessionId: '67c1b2c3d4e5f67890123456',
                  fileName: 'resume.pdf',
                  skillsDetected: ['Python', 'FastAPI', 'React'],
                  resumeQuestionsReady: false,
                  message: 'Resume uploaded. Questions are being generated in background.',
                  status: 'processing'
                }
              }
            ),
            400: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/resume/{sessionId}/data': {
        get: {
          tags: ['Resume'],
          summary: 'Get parsed resume data for a session',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessionId: '67c1b2c3d4e5f67890123456',
                  resumeSummary: 'Experienced full-stack developer...',
                  skillsDetected: ['Python', 'FastAPI', 'React'],
                  hasQuestions: true
                }
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/resume/{sessionId}/questions': {
        get: {
          tags: ['Resume'],
          summary: 'Get generated resume questions for a session',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'includeAsked',
              in: 'query',
              required: false,
              schema: { type: 'string', default: 'false' }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessionId: '67c1b2c3d4e5f67890123456',
                  questions: [
                    {
                      id: '67c1b2c3d4e5f67890123457',
                      question: 'Walk me through the architecture of your resume project.',
                      type: 'project',
                      difficulty: 'medium',
                      section: 'Projects',
                      asked: false
                    }
                  ],
                  totalCount: 12,
                  remainingCount: 9
                }
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/session': {
        get: {
          tags: ['Sessions'],
          summary: 'List interview sessions',
          parameters: [
            { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 10 } },
            { name: 'state', in: 'query', required: false, schema: { type: 'string', enum: SESSION_STATE_ENUM } },
            { name: 'sortBy', in: 'query', required: false, schema: { type: 'string', default: 'createdAt' } },
            { name: 'sortOrder', in: 'query', required: false, schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  sessions: [
                    {
                      id: '67c1b2c3d4e5f67890123456',
                      state: 'FINISHED',
                      skills: ['Python', 'React'],
                      questionsAsked: 20,
                      finalScore: 81,
                      duration: 24
                    }
                  ],
                  pagination: { total: 42, page: 1, pages: 5, limit: 10 }
                }
              }
            )
          }
        }
      },
      '/api/session/stats/summary': {
        get: {
          tags: ['Sessions'],
          summary: 'Get aggregated session analytics',
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  summary: {
                    totalSessions: 42,
                    completedSessions: 35,
                    completionRate: 83,
                    avgScore: 68,
                    avgQuestionsAsked: 22
                  },
                  stateDistribution: [{ state: 'FINISHED', count: 35 }],
                  topSkills: [{ skill: 'Python', count: 30 }]
                }
              }
            )
          }
        }
      },
      '/api/session/{sessionId}': {
        get: {
          tags: ['Sessions'],
          summary: 'Get full session details',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  id: '67c1b2c3d4e5f67890123456',
                  state: 'DEEP_DIVE',
                  skills: ['Python', 'React'],
                  currentTopic: 'Python',
                  questionsAsked: 10,
                  resumeQuestions: 12,
                  resumeQuestionsAsked: 3,
                  finalScore: 81
                }
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        },
        delete: {
          tags: ['Sessions'],
          summary: 'Delete a session',
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                message: 'Session deleted successfully'
              }
            ),
            404: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/proctoring/status': {
        get: {
          tags: ['Proctoring Proxy'],
          summary: 'Get proxied proctoring status',
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  status: 'SAFE',
                  reason: 'SAFE'
                }
              }
            ),
            503: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/proctoring/start': {
        post: {
          tags: ['Proctoring Proxy'],
          summary: 'Start the standalone proctoring service',
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  message: 'Proctoring started'
                }
              }
            ),
            503: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/proctoring/stop': {
        post: {
          tags: ['Proctoring Proxy'],
          summary: 'Stop the standalone proctoring service',
          responses: {
            200: jsonResponse(
              { type: 'object' },
              {
                success: true,
                data: {
                  message: 'Proctoring stopped'
                }
              }
            ),
            503: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      },
      '/api/proctoring/video': {
        get: {
          tags: ['Proctoring Proxy'],
          summary: 'Open the proxied MJPEG video stream',
          responses: {
            200: {
              description: 'MJPEG stream forwarded from the standalone proctoring service',
              content: {
                'multipart/x-mixed-replace; boundary=frame': {
                  schema: { type: 'string', format: 'binary' }
                }
              }
            },
            503: jsonResponse({ $ref: '#/components/schemas/ErrorResponse' })
          }
        }
      }
    }
  };
}

function renderSwaggerUiHtml(specUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SkillWise — Interviewer Bot</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      background: linear-gradient(180deg, #eef4fb 0%, #e2ebf5 100%);
      color: #0f172a;
    }
    .hero {
      padding: 32px 32px 22px;
      color: #f8fafc;
      font-family: "Segoe UI", Arial, sans-serif;
      background:
        radial-gradient(circle at top right, rgba(125, 211, 252, 0.24), transparent 32%),
        linear-gradient(160deg, #0b1324 0%, #12314b 100%);
      border-bottom: 1px solid rgba(15, 23, 42, 0.12);
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: 28px;
    }
    .hero p {
      margin: 0;
      max-width: 820px;
      color: #dbeafe;
      line-height: 1.6;
    }
    .hero a {
      color: #fde68a;
    }
    #swagger-ui {
      max-width: 1280px;
      margin: 24px auto 40px;
      padding: 0 16px 28px;
    }
    .swagger-ui {
      background: #ffffff;
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
      padding: 20px 24px 32px;
    }
    .swagger-ui, .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info table, .swagger-ui .info a, .swagger-ui .opblock-description-wrapper p, .swagger-ui .opblock-external-docs-wrapper p, .swagger-ui .response-col_status, .swagger-ui .response-col_links, .swagger-ui .tab li, .swagger-ui .model-title, .swagger-ui .parameter__name, .swagger-ui .parameter__type, .swagger-ui .parameter__deprecated, .swagger-ui .parameter__in, .swagger-ui .responses-inner h4, .swagger-ui .responses-inner h5, .swagger-ui .opblock-summary-description {
      color: #1f2937;
    }
    .swagger-ui .info {
      margin: 0 0 20px;
    }
    .swagger-ui .info .title {
      color: #0f172a;
    }
    .swagger-ui .scheme-container {
      background: #f8fafc;
      box-shadow: none;
      border: 1px solid #dbe4ee;
      border-radius: 18px;
      padding: 16px 18px;
      margin: 0 0 18px;
    }
    .swagger-ui .opblock-tag {
      border-bottom: 1px solid #e5e7eb;
      color: #0f172a;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    }
    .swagger-ui .opblock {
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      margin: 0 0 16px;
    }
    .swagger-ui .opblock .opblock-summary {
      align-items: center;
    }
    .swagger-ui .opblock .opblock-summary-method {
      border-radius: 999px;
      min-width: 72px;
    }
    .swagger-ui .btn.execute {
      background: #0f766e;
      border-color: #0f766e;
    }
    .swagger-ui .btn.execute:hover {
      background: #115e59;
      border-color: #115e59;
    }
    .swagger-ui input, .swagger-ui textarea, .swagger-ui select {
      color: #111827;
      background: #ffffff;
    }
    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <section class="hero">
    <h1>SkillWise — Interviewer Bot</h1>
    <p>
      Swagger workspace for the SkillWise Interviewer Bot backend. For the Proctoring System and ML Service docs,
      visit the <a href="http://localhost:5000/api-docs" target="_blank" rel="noopener noreferrer">SkillWise API Docs Hub</a>.
    </p>
  </section>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      deepLinking: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      filter: true,
      tryItOutEnabled: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`;
}

module.exports = {
  getOpenApiDocument,
  renderSwaggerUiHtml
};
