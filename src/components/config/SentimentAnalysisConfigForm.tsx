import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  Typography,
  Slider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import MoodIcon from '@mui/icons-material/Mood';
import sentimentAnalysisService, { SentimentAnalysisConfig } from '../../services/sentimentAnalysisService';

interface SentimentAnalysisConfigProps {
  onConfigSaved?: () => void;
}

const SentimentAnalysisConfigForm: React.FC<SentimentAnalysisConfigProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<SentimentAnalysisConfig>({
    enableSentimentAnalysis: true,
    confidenceThreshold: 0.7,
    analyzeAllComments: true,
    includeKeywordExtraction: true,
    includeEntityAnalysis: true,
    sentimentRefreshInterval: 60,
    alertOnNegativeTrend: true,
    negativeThreshold: -0.3,
    positiveThreshold: 0.3,
    defaultLanguage: 'en',
    useRealData: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    // Load config from sentiment analysis service
    const savedConfig = sentimentAnalysisService.getConfig();
    setConfig(savedConfig);
  }, []);

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.checked,
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setConfig({
      ...config,
      [name]: value,
    });
  };

  const handleSliderChange = (name: string) => (event: Event, newValue: number | number[]) => {
    setConfig({
      ...config,
      [name]: newValue,
    });
  };

  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    setConfig({
      ...config,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Update the sentiment analysis config
      sentimentAnalysisService.updateConfig(config);
      
      setSaveSuccess(true);
      if (onConfigSaved) {
        onConfigSaved();
      }
    } catch (error) {
      console.error('Error saving sentiment analysis config:', error);
      setSaveError('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader 
          title="Sentiment Analysis Configuration" 
          subheader="Configure how the AI analyzes sentiment in comments and work items"
          avatar={<MoodIcon color="primary" />}
        />
        <Divider />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableSentimentAnalysis}
                    onChange={handleSwitchChange}
                    name="enableSentimentAnalysis"
                    color="primary"
                  />
                }
                label="Enable Sentiment Analysis"
              />
              <Typography variant="body2" color="text.secondary">
                Analyze the sentiment of comments and work item descriptions to detect team morale and potential issues.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Confidence Threshold: {config.confidenceThreshold}
              </Typography>
              <Slider
                value={config.confidenceThreshold}
                onChange={handleSliderChange('confidenceThreshold')}
                aria-labelledby="confidence-threshold-slider"
                step={0.05}
                marks
                min={0.5}
                max={0.95}
                disabled={!config.enableSentimentAnalysis}
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" color="text.secondary">
                Minimum confidence level required for sentiment analysis results to be considered valid.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sentiment Refresh Interval (minutes)"
                name="sentimentRefreshInterval"
                type="number"
                value={config.sentimentRefreshInterval}
                onChange={handleInputChange}
                disabled={!config.enableSentimentAnalysis}
                InputProps={{ inputProps: { min: 15, max: 1440 } }}
                helperText="How often to refresh sentiment analysis for active work items"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.analyzeAllComments}
                    onChange={handleSwitchChange}
                    name="analyzeAllComments"
                    color="primary"
                    disabled={!config.enableSentimentAnalysis}
                  />
                }
                label="Analyze All Comments"
              />
              <Typography variant="body2" color="text.secondary">
                If disabled, only analyzes the most recent comments for each work item.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.alertOnNegativeTrend}
                    onChange={handleSwitchChange}
                    name="alertOnNegativeTrend"
                    color="primary"
                    disabled={!config.enableSentimentAnalysis}
                  />
                }
                label="Alert on Negative Sentiment Trends"
              />
              <Typography variant="body2" color="text.secondary">
                Receive alerts when a developer's sentiment shows a negative trend.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeKeywordExtraction}
                    onChange={handleSwitchChange}
                    name="includeKeywordExtraction"
                    color="primary"
                    disabled={!config.enableSentimentAnalysis}
                  />
                }
                label="Extract Keywords"
              />
              <Typography variant="body2" color="text.secondary">
                Extract and analyze important keywords from comments.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.includeEntityAnalysis}
                    onChange={handleSwitchChange}
                    name="includeEntityAnalysis"
                    color="primary"
                    disabled={!config.enableSentimentAnalysis}
                  />
                }
                label="Analyze Entities"
              />
              <Typography variant="body2" color="text.secondary">
                Identify and analyze sentiment for specific entities mentioned in comments.
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.useRealData}
                    onChange={handleSwitchChange}
                    name="useRealData"
                    color="primary"
                    disabled={!config.enableSentimentAnalysis}
                  />
                }
                label="Use Real Data from ADO"
              />
              <Typography variant="body2" color="text.secondary">
                If enabled, sentiment analysis will use real comments from Azure DevOps. Otherwise, sample data will be used.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Negative Sentiment Threshold: {config.negativeThreshold}
              </Typography>
              <Slider
                value={config.negativeThreshold}
                onChange={handleSliderChange('negativeThreshold')}
                aria-labelledby="negative-threshold-slider"
                step={0.1}
                marks
                min={-0.9}
                max={-0.1}
                disabled={!config.enableSentimentAnalysis}
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" color="text.secondary">
                Score threshold for classifying comments as negative.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Positive Sentiment Threshold: {config.positiveThreshold}
              </Typography>
              <Slider
                value={config.positiveThreshold}
                onChange={handleSliderChange('positiveThreshold')}
                aria-labelledby="positive-threshold-slider"
                step={0.1}
                marks
                min={0.1}
                max={0.9}
                disabled={!config.enableSentimentAnalysis}
                valueLabelDisplay="auto"
              />
              <Typography variant="body2" color="text.secondary">
                Score threshold for classifying comments as positive.
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth disabled={!config.enableSentimentAnalysis}>
                <InputLabel id="language-select-label">Default Language</InputLabel>
                <Select
                  labelId="language-select-label"
                  id="language-select"
                  name="defaultLanguage"
                  value={config.defaultLanguage}
                  label="Default Language"
                  onChange={handleSelectChange}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                  <MenuItem value="de">German</MenuItem>
                  <MenuItem value="zh">Chinese</MenuItem>
                  <MenuItem value="ja">Japanese</MenuItem>
                  <MenuItem value="auto">Auto-detect</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary">
                Default language for sentiment analysis.
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  {saveSuccess && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      Configuration saved successfully!
                    </Alert>
                  )}
                  {saveError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {saveError}
                    </Alert>
                  )}
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSaving}
                  startIcon={<SaveIcon />}
                >
                  Save Configuration
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </form>
  );
};

export default SentimentAnalysisConfigForm;
