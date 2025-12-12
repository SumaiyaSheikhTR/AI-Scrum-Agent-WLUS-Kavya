import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Psychology as BrainIcon,
  TrendingUp as PositiveIcon,
  TrendingDown as NegativeIcon,
  TrendingFlat as NeutralIcon,
  Speed as SpeedIcon,
  Science as ScienceIcon
} from '@mui/icons-material';
import { simplifiedSentimentService, SimpleSentimentResult, SimpleSentimentConfig } from '../../services/simplifiedSentimentService';

const SentimentAnalysisDemo: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<SimpleSentimentResult[]>([]);
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [config, setConfig] = useState<SimpleSentimentConfig>({
    provider: 'enhanced-rules',
    enableEmotionDetection: true,
    confidenceThreshold: 0.6
  });

  // Sample texts for testing
  const sampleTexts = [
    "This is an excellent feature! The team did an amazing job implementing it.",
    "There are some critical bugs that need to be fixed immediately. This is frustrating.",
    "The sprint review meeting is scheduled for tomorrow at 2 PM.",
    "I'm really excited about the new AI integration. It's working perfectly!",
    "The system is completely broken and nothing works. This is a disaster.",
    "Updated the documentation and created unit tests for the new service.",
    "Great job on resolving the performance issues! The application is much faster now.",
    "We need to discuss the technical debt in our next planning meeting."
  ];

  useEffect(() => {
    const init = async () => {
      try {
        await simplifiedSentimentService.initialize(config);
        const status = simplifiedSentimentService.getStatus();
        setServiceStatus(status);
      } catch (error) {
        console.error('Failed to initialize sentiment service:', error);
      }
    };
    
    init();
  }, [config]);

  const analyzeSingleText = async () => {
    if (!inputText.trim()) return;

    setIsAnalyzing(true);
    try {
      const result = await simplifiedSentimentService.analyzeSentiment(inputText);
      setResults([result, ...results]);
      setInputText('');
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeSampleTexts = async () => {
    setIsAnalyzing(true);
    try {
      const batchResults = await simplifiedSentimentService.analyzeBatch(sampleTexts);
      setResults([...batchResults, ...results]);
    } catch (error) {
      console.error('Batch analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const updateConfig = async () => {
    simplifiedSentimentService.updateConfig(config);
    try {
      await simplifiedSentimentService.initialize(config);
      const status = simplifiedSentimentService.getStatus();
      setServiceStatus(status);
    } catch (error) {
      console.error('Failed to re-initialize sentiment service:', error);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <PositiveIcon sx={{ color: '#4caf50' }} />;
      case 'negative':
        return <NegativeIcon sx={{ color: '#f44336' }} />;
      default:
        return <NeutralIcon sx={{ color: '#ff9800' }} />;
    }
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment) {
      case 'positive':
        return '#4caf50';
      case 'negative':
        return '#f44336';
      default:
        return '#ff9800';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#4caf50';
    if (confidence >= 0.6) return '#ff9800';
    return '#f44336';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <BrainIcon sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
        Enhanced Rule-Based Sentiment Analysis Demo
      </Typography>

      {/* Service Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
            <ScienceIcon sx={{ mr: 1 }} />
            Service Status
          </Typography>
          
          {serviceStatus && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2">
                  <strong>Initialized:</strong> {serviceStatus.isInitialized ? '✅ Yes' : '❌ No'}
                </Typography>
                <Typography variant="body2">
                  <strong>Available Providers:</strong> {serviceStatus.availableProviders.join(', ')}
                </Typography>
                <Typography variant="body2">
                  <strong>Current Provider:</strong> {config.provider}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                {serviceStatus.recommendations.length > 0 && (
                  <Alert severity="info">
                    <AlertTitle>Recommendations</AlertTitle>
                    <Box component="ul" sx={{ margin: 0, paddingLeft: 2.5 }}>
                      {serviceStatus.recommendations.map((rec: string, idx: number) => (
                        <Box component="li" key={idx}>{rec}</Box>
                      ))}
                    </Box>
                  </Alert>
                )}
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Configuration</Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Provider</InputLabel>
                <Select
                  value={config.provider}
                  label="Provider"
                  onChange={(e) => setConfig({...config, provider: e.target.value as any})}
                >
                  <MenuItem value="rule-based">Rule-Based</MenuItem>
                  <MenuItem value="enhanced-rules">Enhanced Rules (Recommended)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableEmotionDetection}
                    onChange={(e) => setConfig({...config, enableEmotionDetection: e.target.checked})}
                  />
                }
                label="Emotion Detection"
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <TextField
                size="small"
                label="Confidence Threshold"
                type="number"
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                value={config.confidenceThreshold}
                onChange={(e) => setConfig({...config, confidenceThreshold: parseFloat(e.target.value)})}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <Button variant="outlined" onClick={updateConfig} size="small">
                Update Config
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Input Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Analyze Text</Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Enter text to analyze"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your text here..."
                disabled={isAnalyzing}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  onClick={analyzeSingleText}
                  disabled={!inputText.trim() || isAnalyzing}
                  startIcon={<BrainIcon />}
                >
                  Analyze Text
                </Button>
                
                <Button
                  variant="outlined"
                  onClick={analyzeSampleTexts}
                  disabled={isAnalyzing}
                  startIcon={<SpeedIcon />}
                >
                  Analyze Sample Texts
                </Button>
                
                <Button
                  variant="text"
                  onClick={clearResults}
                  disabled={results.length === 0}
                >
                  Clear Results
                </Button>
              </Box>
            </Grid>
          </Grid>

          {isAnalyzing && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Analyzing sentiment...
              </Typography>
              <LinearProgress />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Analysis Results ({results.length})
            </Typography>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Text</TableCell>
                    <TableCell>Sentiment</TableCell>
                    <TableCell>Score</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Time (ms)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.slice(0, 20).map((result, index) => (
                    <TableRow key={index}>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography variant="body2" sx={{ 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {result.text}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getSentimentIcon(result.sentiment)}
                          <Chip
                            label={result.sentiment}
                            size="small"
                            sx={{ 
                              ml: 1,
                              backgroundColor: getSentimentColor(result.sentiment),
                              color: 'white'
                            }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: result.score > 0 ? '#4caf50' : result.score < 0 ? '#f44336' : '#ff9800',
                            fontWeight: 'bold'
                          }}
                        >
                          {result.score.toFixed(3)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <LinearProgress
                            variant="determinate"
                            value={result.confidence * 100}
                            sx={{ 
                              width: 60, 
                              mr: 1,
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: getConfidenceColor(result.confidence)
                              }
                            }}
                          />
                          <Typography variant="body2">
                            {(result.confidence * 100).toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip label={result.provider} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {result.processingTime}ms
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {results.length > 20 && (
              <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', color: 'text.secondary' }}>
                Showing first 20 results of {results.length}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default SentimentAnalysisDemo;
