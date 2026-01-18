/**
 * Test script for planning agent with dummy session data
 */

const dummyAnalysisSummary = {
  goalInferred: "Preparing for software engineering interviews",
  workspaces: [
    {
      label: "LeetCode Practice",
      timeSec: 1800, // 30 minutes
      topUrls: [
        "https://leetcode.com/problems/two-sum",
        "https://leetcode.com/problems/valid-parentheses"
      ]
    },
    {
      label: "Documentation Study",
      timeSec: 1200, // 20 minutes
      topUrls: [
        "https://docs.python.org/3/",
        "https://developer.mozilla.org/en-US/docs/Web/JavaScript"
      ]
    },
    {
      label: "Interview Prep",
      timeSec: 900, // 15 minutes
      topUrls: [
        "https://www.glassdoor.com/Interview/software-engineer-interview-questions-SRCH_KO0,18.htm"
      ]
    }
  ],
  resumeSummary: "You spent time practicing coding problems on LeetCode, studying Python and JavaScript documentation, and researching common interview questions.",
  lastStop: {
    label: "LeetCode - Two Sum",
    url: "https://leetcode.com/problems/two-sum"
  },
  nextActions: [
    "Complete the two-sum problem solution",
    "Review time complexity analysis",
    "Practice more array problems"
  ],
  pendingDecisions: [
    "Choose focus area: Data structures vs Algorithms",
    "Decide on study schedule for next week"
  ]
};

async function testPlanningAgent() {
  console.log('🧪 Testing Planning Agent with Dummy Session Data\n');
  console.log('Analysis Summary:');
  console.log(JSON.stringify(dummyAnalysisSummary, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Test the planning agent API directly
    const response = await fetch('http://localhost:3000/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        analysisSummary: dummyAnalysisSummary,
        userGoal: "Prepare for software engineering interviews"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Planning API Error:', response.status, errorText);
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Unexpected response format:', contentType);
      console.error('Response:', text.substring(0, 200));
      return;
    }

    const taskPlan = await response.json();
    
    console.log('✅ Planning Agent Response:\n');
    console.log(JSON.stringify(taskPlan, null, 2));
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Pretty print tasks
    if (taskPlan.prioritizedTasks && taskPlan.prioritizedTasks.length > 0) {
      console.log('📋 Prioritized Tasks:\n');
      taskPlan.prioritizedTasks.forEach((task: any, index: number) => {
        console.log(`${index + 1}. ${task.title}`);
        console.log(`   Priority: ${task.priority} | Urgency: ${task.urgency}`);
        if (task.estimatedTime) {
          console.log(`   ⏱️  Estimated: ${task.estimatedTime}`);
        }
        if (task.reason) {
          console.log(`   💡 Reason: ${task.reason}`);
        }
        if (task.dependencies && task.dependencies.length > 0) {
          console.log(`   🔗 Depends on: ${task.dependencies.join(', ')}`);
        }
        console.log('');
      });
    }

    if (taskPlan.suggestions && taskPlan.suggestions.length > 0) {
      console.log('💬 Strategic Suggestions:\n');
      taskPlan.suggestions.forEach((suggestion: string, index: number) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
      console.log('');
    }

    if (taskPlan.insights && taskPlan.insights.length > 0) {
      console.log('🔍 Insights:\n');
      taskPlan.insights.forEach((insight: string, index: number) => {
        console.log(`   ${index + 1}. ${insight}`);
      });
      console.log('');
    }

    if (taskPlan.taskOrder && taskPlan.taskOrder.length > 0) {
      console.log('📊 Recommended Task Order:\n');
      taskPlan.taskOrder.forEach((taskId: string, index: number) => {
        const task = taskPlan.prioritizedTasks.find((t: any) => t.id === taskId);
        console.log(`   ${index + 1}. ${task?.title || taskId}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error testing planning agent:', error.message);
    console.error(error);
  }
}

// Run the test
testPlanningAgent();
