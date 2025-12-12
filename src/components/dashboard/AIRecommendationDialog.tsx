import React from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Chip
} from '@mui/material';
import { Assignment as AssignmentIcon } from '@mui/icons-material';
import { TeamMember } from '../../services/adoService';
import CollapsibleSection from '../common/CollapsibleSection';

interface AIRecommendation {
  member: string;
  recommendation: string;
  suggestedActions: string[];
  adoLinks?: string[];
  utilizationLevel?: string;
  priority?: string;
  tasksToRemove?: any[];
  tasksToAssign?: any[];
  autoAssignTags?: string[];
  autoRemoveTags?: string[];
}

interface AIRecommendationDialogProps {
  open: boolean;
  onClose: () => void;
  selectedMember: TeamMember | null;
  aiRecommendations: AIRecommendation[];
  chatMessages: { [member: string]: { sender: string; text: string; adoLinks?: string[]; autoAssignTags?: string[]; autoRemoveTags?: string[] }[] };
  chatInput: string;
  isChatLoading: boolean;
  onChatInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendChat: () => void;
  expandedSections: {
    recommendation: boolean;
    tasksToAssign: boolean;
    tasksToRemove: boolean;
    chat: boolean;
  };
  toggleSection: (section: 'recommendation' | 'tasksToAssign' | 'tasksToRemove' | 'chat') => void;
}

// Helper function to process HTML description
const processHtmlDescription = (description: string | null | undefined): string => {
  if (!description || typeof description !== 'string') return '';
  
  // Replace all HTML entities with their respective HTML tags
  return description
    .replace(/&lt;div&gt;/g, '<div>')
    .replace(/&lt;\/div&gt;/g, '</div>')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

const AIRecommendationDialog: React.FC<AIRecommendationDialogProps> = ({
  open,
  onClose,
  selectedMember,
  aiRecommendations,
  chatMessages,
  chatInput,
  isChatLoading,
  onChatInputChange,
  onSendChat,
  expandedSections,
  toggleSection
}) => {
  if (!selectedMember) return null;
  
  const memberRecommendation = aiRecommendations.find(rec => rec.member === selectedMember.displayName);
  if (!memberRecommendation) return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>AI Agentic Solutions</DialogTitle>
      <DialogContent>
        <Typography>No recommendation available.</Typography>
      </DialogContent>
    </Dialog>
  );
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">AI Agentic Solutions for {selectedMember.displayName}</Typography>
          <Button onClick={onClose} color="inherit" size="small">Close</Button>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box>
          {/* Recommendation Section */}
          <CollapsibleSection
            title="Agentic AI Recommendation"
            color="#1976d2"
            backgroundColor="#e3f2fd"
            hoverBackgroundColor="#d0e8fc"
            isExpanded={expandedSections.recommendation}
            toggleExpanded={() => toggleSection('recommendation')}
          >
            <Typography variant="body2" sx={{ mb: 2, color: '#333' }}>
              {memberRecommendation.recommendation && memberRecommendation.recommendation.length > 150 
                ? memberRecommendation.recommendation.substring(0, 150) + '...'
                : memberRecommendation.recommendation}
            </Typography>
            
            {/* Removed ADO Links from here - will display in Tasks sections */}
            
            <List sx={{ mb: 2 }}>
              {memberRecommendation.suggestedActions && memberRecommendation.suggestedActions.length > 0 ? (
                // Show actual AI recommendations if available
                memberRecommendation.suggestedActions.slice(0, 3).map((action, idx) => (
                  <ListItem key={idx} alignItems="flex-start" sx={{ pb: 1 }}>
                    <ListItemText
                      primary={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Suggestion {idx + 1}</Typography>}
                      secondary={<Typography variant="body2" sx={{ color: '#555' }}>{action}</Typography>}
                    />
                  </ListItem>
                ))
              ) : (
                // Simple placeholder if no suggestions available
                <ListItem alignItems="flex-start" sx={{ pb: 1 }}>
                  <ListItemText
                    primary={<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Capacity Analysis</Typography>}
                    secondary={<Typography variant="body2" sx={{ color: '#555' }}>
                      AI recommendation for {selectedMember.displayName} based on current workload and capacity.
                    </Typography>}
                  />
                </ListItem>
              )}
            </List>
            
            {/* Display auto assign/remove tags if available */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {memberRecommendation.autoAssignTags && memberRecommendation.autoAssignTags.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main', display: 'block', mb: 0.5 }}>
                    Automatic Assignment Tags:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {memberRecommendation.autoAssignTags.map((tag, idx) => (
                      <Chip
                        key={idx}
                        label={tag}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {memberRecommendation.autoRemoveTags && memberRecommendation.autoRemoveTags.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main', display: 'block', mb: 0.5 }}>
                    Automatic Removal Tags:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {memberRecommendation.autoRemoveTags.map((tag, idx) => (
                      <Chip
                        key={idx}
                        label={tag}
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </CollapsibleSection>
          
          {/* Tasks to Assign Section */}
          <CollapsibleSection
            title="Tasks to Assign"
            color="#1976d2"
            backgroundColor="#f6f8fa"
            hoverBackgroundColor="#e8eef2"
            isExpanded={expandedSections.tasksToAssign}
            toggleExpanded={() => toggleSection('tasksToAssign')}
          >
            {/* Display relevant ADO Links if available */}
            {memberRecommendation.adoLinks && memberRecommendation.adoLinks.length > 0 && (
              <Box sx={{ mb: 2, p: 1, background: 'rgba(25, 118, 210, 0.1)', borderRadius: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Work Item Links:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {memberRecommendation.adoLinks.map((link, i) => (
                    <Button 
                      key={i}
                      href={link}
                      target="_blank"
                      variant="outlined"
                      size="small"
                      startIcon={<AssignmentIcon />}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      Item #{link.split('/').pop()}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}
            
            {(memberRecommendation.tasksToAssign || []).length === 0 ? (
              memberRecommendation.autoAssignTags && memberRecommendation.autoAssignTags.length > 0 ? (
                <Box sx={{ mb: 2, p: 1, background: 'rgba(76, 175, 80, 0.1)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Tasks to Assign:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {memberRecommendation.autoAssignTags.map((tag, idx) => {
                      // Extract the task ID from tag (remove # if present)
                      const taskId = tag.replace('#', '');
                      // Get organization from ADO config
                      const adoConfig = localStorage.getItem('adoConfig') ? 
                        JSON.parse(localStorage.getItem('adoConfig') || '{}') : {};
                      const organization = adoConfig.organization || '';
                      const url = `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
                      
                      return (
                        <Button 
                          key={idx}
                          href={url}
                          target="_blank"
                          variant="outlined"
                          color="success"
                          size="small"
                          startIcon={<AssignmentIcon />}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          #{taskId}
                        </Button>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No tasks to assign.</Typography>
              )
            ) : (
              <List>
                {(memberRecommendation.tasksToAssign || []).map((task: any, idx: number) => (
                  <ListItem key={idx} sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
                    <ListItemText
                      primary={<span className="agentic-task-title">{task.title || task.name || `Task ${idx + 1}`}</span>}
                      secondary={
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: processHtmlDescription(task.description)
                          }}
                        />
                      }
                    />
                    {(task.adoLink || task.id) && (
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        href={task.adoLink || `https://dev.azure.com/${localStorage.getItem('adoConfig') ? 
                          JSON.parse(localStorage.getItem('adoConfig') || '{}').organization : ''}/_workitems/edit/${task.id}`}
                        target="_blank"
                        startIcon={<AssignmentIcon />}
                        sx={{ ml: 2, fontWeight: 600 }}
                      >
                        #{task.id || task.adoLink?.split('/').pop()}
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </CollapsibleSection>
          
          {/* Tasks to Remove Section */}
          <CollapsibleSection
            title="Tasks to Remove"
            color="#d84315"
            backgroundColor="#fff3e0"
            hoverBackgroundColor="#ffe0b2"
            isExpanded={expandedSections.tasksToRemove}
            toggleExpanded={() => toggleSection('tasksToRemove')}
          >
            {(memberRecommendation.tasksToRemove || []).length === 0 ? (
              memberRecommendation.autoRemoveTags && memberRecommendation.autoRemoveTags.length > 0 ? (
                <Box sx={{ mb: 2, p: 1, background: 'rgba(244, 67, 54, 0.1)', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Tasks to Remove:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {memberRecommendation.autoRemoveTags.map((tag, idx) => {
                      // Extract the task ID from tag (remove # if present)
                      const taskId = tag.replace('#', '');
                      // Get organization from ADO config
                      const adoConfig = localStorage.getItem('adoConfig') ? 
                        JSON.parse(localStorage.getItem('adoConfig') || '{}') : {};
                      const organization = adoConfig.organization || '';
                      const url = `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
                      
                      return (
                        <Button 
                          key={idx}
                          href={url}
                          target="_blank"
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<AssignmentIcon />}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          #{taskId}
                        </Button>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No tasks to remove.</Typography>
              )
            ) : (
              <List>
                {(memberRecommendation.tasksToRemove || []).map((task: any, idx: number) => (
                  <ListItem key={idx} sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
                    <ListItemText
                      primary={<span className="agentic-task-title">{task.title || task.name || `Task ${idx + 1}`}</span>}
                      secondary={
                        <div 
                          dangerouslySetInnerHTML={{ 
                            __html: processHtmlDescription(task.description)
                          }}
                        />
                      }
                    />
                    {(task.adoLink || task.id) && (
                      <Button
                        variant="contained"
                        color="secondary"
                        size="small"
                        href={task.adoLink || `https://dev.azure.com/${localStorage.getItem('adoConfig') ? 
                          JSON.parse(localStorage.getItem('adoConfig') || '{}').organization : ''}/_workitems/edit/${task.id}`}
                        target="_blank"
                        startIcon={<AssignmentIcon />}
                        sx={{ ml: 2, fontWeight: 600 }}
                      >
                        #{task.id || task.adoLink?.split('/').pop()}
                      </Button>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </CollapsibleSection>
          
          {/* Chat Section */}
          <CollapsibleSection
            title="Agentic AI Chat"
            color="#333"
            backgroundColor="linear-gradient(135deg, #f5f7fa 0%, #e4eaff 100%)"
            hoverBackgroundColor="linear-gradient(135deg, #e9ebee 0%, #d4daff 100%)"
            isExpanded={expandedSections.chat}
            toggleExpanded={() => toggleSection('chat')}
          >
            <Box sx={{ 
              mb: 2, 
              maxHeight: 200, 
              overflowY: 'auto', 
              borderRadius: 2
            }}>
              {(chatMessages[selectedMember.displayName] || []).map((msg, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start',
                    justifyContent: msg.sender === 'You' ? 'flex-end' : 'flex-start' 
                  }}>
                    {msg.sender !== 'You' && (
                      <Avatar sx={{ 
                        width: 28, 
                        height: 28, 
                        mr: 1, 
                        bgcolor: '#9c27b0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                      }}>
                        AI
                      </Avatar>
                    )}
                    <Box sx={{ 
                      background: msg.sender === 'You' ? '#e3f2fd' : 'white', 
                      borderRadius: '18px', 
                      px: 2, 
                      py: 1.5, 
                      maxWidth: '85%',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      border: msg.sender === 'You' ? '1px solid #bbdefb' : '1px solid #e0e0e0'
                    }}>
                      <Typography 
                        variant="body2" 
                        color={msg.sender === 'You' ? 'primary' : 'text.primary'}
                        sx={{ 
                          whiteSpace: 'pre-wrap', 
                          '& code': {
                            backgroundColor: '#f5f5f5',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontFamily: 'monospace',
                            fontSize: '0.85em'
                          },
                          '& a': {
                            color: '#0277bd',
                            textDecoration: 'none',
                            '&:hover': {
                              textDecoration: 'underline'
                            }
                          },
                          '& ul, & ol': {
                            paddingLeft: 2,
                            marginTop: 0.5,
                            marginBottom: 0.5
                          },
                          '& p': {
                            marginTop: 0.5,
                            marginBottom: 0.5
                          }
                        }}
                      >
                        {msg.text.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < msg.text.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </Typography>
                    </Box>
                    {msg.sender === 'You' && (
                      <Avatar sx={{ 
                        width: 28, 
                        height: 28, 
                        ml: 1, 
                        bgcolor: '#1976d2',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                      }}>
                        U
                      </Avatar>
                    )}
                  </Box>
                  
                  {/* Show ADO links if available */}
                  {msg.adoLinks && msg.adoLinks.length > 0 && (
                    <Box sx={{ mt: 1, ml: msg.sender === 'You' ? 0 : 4, mr: msg.sender === 'You' ? 4 : 0, textAlign: msg.sender === 'You' ? 'right' : 'left' }}>
                      <Box sx={{ 
                        display: 'inline-flex', 
                        flexWrap: 'wrap', 
                        gap: 0.5, 
                        justifyContent: msg.sender === 'You' ? 'flex-end' : 'flex-start'
                      }}>
                        {msg.adoLinks.map((link, linkIdx) => (
                          <Button 
                            key={linkIdx}
                            href={link}
                            target="_blank"
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<AssignmentIcon fontSize="small" />}
                            sx={{ 
                              fontSize: '0.7rem', 
                              py: 0.3, 
                              px: 0.8, 
                              borderRadius: '16px',
                              textTransform: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                          >
                            #{link.split('/').pop()}
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  )}
                  
                  {/* Show auto assign tags if available */}
                  {msg.autoAssignTags && msg.autoAssignTags.length > 0 && (
                    <Box sx={{ mt: 1, ml: 4, textAlign: 'left' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main', display: 'block', mb: 0.5 }}>
                        Automatic Assignment Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {msg.autoAssignTags.map((tag, tagIdx) => {
                          // Extract the task ID from tag (remove # if present)
                          const taskId = tag.replace('#', '');
                          // Get organization from ADO config
                          const adoConfig = localStorage.getItem('adoConfig') ? 
                            JSON.parse(localStorage.getItem('adoConfig') || '{}') : {};
                          const organization = adoConfig.organization || '';
                          const url = `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
                          
                          return (
                            <Button 
                              key={tagIdx}
                              href={url}
                              target="_blank"
                              variant="outlined"
                              color="success"
                              size="small"
                              startIcon={<AssignmentIcon fontSize="small" />}
                              sx={{ 
                                fontSize: '0.7rem',
                                py: 0.3,
                                px: 0.8,
                                borderRadius: '16px',
                                textTransform: 'none'
                              }}
                            >
                              #{taskId}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                  
                  {/* Show auto remove tags if available */}
                  {msg.autoRemoveTags && msg.autoRemoveTags.length > 0 && (
                    <Box sx={{ mt: 1, ml: 4, textAlign: 'left' }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main', display: 'block', mb: 0.5 }}>
                        Automatic Removal Tags:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {msg.autoRemoveTags.map((tag, tagIdx) => {
                          // Extract the task ID from tag (remove # if present)
                          const taskId = tag.replace('#', '');
                          // Get organization from ADO config
                          const adoConfig = localStorage.getItem('adoConfig') ? 
                            JSON.parse(localStorage.getItem('adoConfig') || '{}') : {};
                          const organization = adoConfig.organization || '';
                          const url = `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
                          
                          return (
                            <Button 
                              key={tagIdx}
                              href={url}
                              target="_blank"
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<AssignmentIcon fontSize="small" />}
                              sx={{ 
                                fontSize: '0.7rem',
                                py: 0.3,
                                px: 0.8,
                                borderRadius: '16px',
                                textTransform: 'none'
                              }}
                            >
                              #{taskId}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}
              {isChatLoading && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={20} sx={{ mr: 1.5, color: '#9c27b0' }} />
                  <Typography variant="body2" sx={{ color: '#666' }}>AI is thinking...</Typography>
                </Box>
              )}
              
              {(!chatMessages[selectedMember.displayName] || chatMessages[selectedMember.displayName].length === 0) && !isChatLoading && (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic' }}>
                    No chat history yet. Start a conversation below.
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask AI about work items or capacity..."
                value={chatInput}
                onChange={onChatInputChange}
                onKeyPress={(e) => e.key === 'Enter' && onSendChat()}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '20px',
                    backgroundColor: '#f9fafc',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#90caf9',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#42a5f5',
                      borderWidth: '1px',
                    },
                  }
                }}
              />
              <Button
                variant="contained"
                color="primary"
                onClick={onSendChat}
                disabled={!chatInput.trim() || isChatLoading}
                sx={{
                  borderRadius: '20px',
                  minWidth: '100px',
                  background: 'linear-gradient(45deg, #42a5f5 30%, #64b5f6 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #2196f3 30%, #42a5f5 90%)',
                  }
                }}
              >
                {isChatLoading ? (
                  <CircularProgress size={24} sx={{ color: 'white' }} />
                ) : (
                  'Send'
                )}
              </Button>
            </Box>
          </CollapsibleSection>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default AIRecommendationDialog;
