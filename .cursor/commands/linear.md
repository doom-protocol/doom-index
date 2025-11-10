# Linear Command

Linearというtask管理アプリを、以下のtool callを使用してuserのinstructionを達成してください。

## supported MCP commands

1. list_comments
2. create_comment
3. list_cycles
4. get_document
5. list_documents
6. get_issue
7. list_issues
8. create_issue
9. update_issue
10. list_issue_statuses
11. get_issue_status
12. list_issue_labels
13. create_issue_label
14. list_projects
15. get_project
16. create_project
17. update_project
18. list_project_labels
19. list_teams
20. get_team
21. list_users
22. get_user
23. search_documentation

## Default Input

owner: DaikoAI
repo: driftie
project: 7e8237d8-9656-4f61-8512-9db66df4c489
team: a0237492-5549-4368-8a64-3a8bf1a5f635

## Output format

- `list_`で始まるコマンドでprojectの一覧や、issueの一覧を表示する場合は、tableを使用して表で出力してください。
